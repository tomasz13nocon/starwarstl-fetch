use neon::prelude::*;
use parse_wiki_text::{Configuration, ListItem, Node};
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
enum SimpleNode {
    List(Vec<Vec<SimpleNode>>),
    Template {
        name: String,
        parameters: Vec<SimpleParameter>,
    },
    Link {
        target: String,
        text: String,
    },
    Text(String),
}

#[derive(Serialize, Debug, PartialEq)]
struct SimpleParameter {
    name: Option<String>,
    value: Vec<SimpleNode>,
}

fn reduce_nodes_to_text(nodes: &Vec<Node>) -> String {
    nodes
        .iter()
        .map(|node| match node {
            Node::Text { value, .. } => value,
            _ => "",
        })
        .collect()
}

fn parse_list_items(items: &Vec<ListItem>, wikitext: &str) -> SimpleNode {
    let mut item_list = Vec::new();
    for item in items {
        item_list.push(parse_nodes(&item.nodes, wikitext));
    }
    SimpleNode::List(item_list)
}

fn parse_nodes(nodes: &Vec<Node>, wikitext: &str) -> Vec<SimpleNode> {
    let mut node_list = Vec::new();
    for node in nodes {
        // TODO CharacterEntity
        match node {
            Node::Link { target, text, .. } => {
                node_list.push(SimpleNode::Link {
                    target: target.to_string(),
                    text: reduce_nodes_to_text(text),
                });
            }
            Node::UnorderedList { items, .. } => {
                node_list.push(parse_list_items(&items, wikitext));
            }
            Node::Text { value, .. } => {
                node_list.push(SimpleNode::Text(value.to_string()));
            }
            Node::Template {
                name, parameters, ..
            } => {
                node_list.push(SimpleNode::Template {
                    name: reduce_nodes_to_text(&name),
                    parameters: parameters
                        .iter()
                        .map(|param| {
                            // Lists don't get parsed inside templates, so parse the raw wikitext
                            // Start after param name, which is part of the param wikitext
                            let name = param.name.as_ref().map(|name| reduce_nodes_to_text(name));
                            let start = match &name {
                                Some(name) => param.start + name.len() + 1,
                                None => param.start,
                            };
                            SimpleParameter {
                                name,
                                value: parse_nodes(
                                    &Configuration::default()
                                        .parse(&wikitext[start..param.end])
                                        .nodes,
                                    wikitext,
                                ),
                            }
                        })
                        .collect(),
                });
            }
            _ => (),
        };
    }
    node_list
}

fn parse(mut cx: FunctionContext) -> JsResult<JsValue> {
    let wikitext = cx.argument::<JsString>(0)?.value(&mut cx);
    let result = Configuration::default().parse(&wikitext);
    if !result.warnings.is_empty() {
        let erroneous_wt = result
            .warnings
            .iter()
            .map(|warn| &wikitext[warn.start..warn.end])
            .collect::<String>();
        return cx.throw_error(format!(
            "Parsing warnings: {:?}\nErroneous wikitext: {:?}",
            result.warnings, erroneous_wt
        ));
    }

    let ret = parse_nodes(&result.nodes, &wikitext);

    Ok(neon_serde3::to_value(&mut cx, &ret)
        .or_else(|e| cx.throw_error(e.to_string()))
        .unwrap())
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("parse", parse)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_list_items() {
        let wt = "*[[target]]";
        let doc = Configuration::default().parse(wt);
        assert!(matches!(&doc.nodes[0], Node::UnorderedList { .. }));
        if let Node::UnorderedList { items, .. } = &doc.nodes[0] {
            let parsed = parse_list_items(items, wt);
            assert_eq!(
                parsed,
                SimpleNode::List(vec![vec![SimpleNode::Link {
                    target: "target".to_string(),
                    text: "target".to_string(),
                }]])
            );
        }
    }

    #[test]
    fn test_list_in_template() {
        let wt = "{{template_name|param_name=\n*[[link_target]]}}";
        let doc = Configuration::default().parse(wt);
        assert!(matches!(&doc.nodes[0], Node::Template { .. }));
        let parsed = parse_nodes(&doc.nodes, wt);
        assert_eq!(
            parsed,
            vec![SimpleNode::Template {
                name: "template_name".to_string(),
                parameters: vec![SimpleParameter {
                    name: Some("param_name".to_string()),
                    value: vec![SimpleNode::List(vec![vec![SimpleNode::Link {
                        target: "link_target".to_string(),
                        text: "link_target".to_string(),
                    }]]),],
                }],
            }]
        );
    }
}
