use std::collections::HashMap;

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

#[derive(Serialize, Debug)]
struct Appearances {
    nodes: Vec<SimpleNode>,
    links: HashMap<String, Vec<Appearance>>, // TODO: Should value be a set instead of vec?
}

#[derive(Serialize, Debug)]
struct Appearance {
    name: String,
    templates: Option<Vec<String>>,
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
            Node::CharacterEntity { character, .. } => {
                node_list.push(SimpleNode::Text(character.to_string()));
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
                            let param_wt = &wikitext[start..param.end];
                            SimpleParameter {
                                name,
                                value: parse_nodes(
                                    &Configuration::default().parse(param_wt).nodes,
                                    param_wt,
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

fn collect_links_from_nodes(nodes: &Vec<SimpleNode>) -> Vec<Appearance> {
    let mut appearances = Vec::new();
    for node in nodes {
        match node {
            SimpleNode::Link { target, .. } => appearances.push(Appearance {
                name: target.to_string(),
                templates: None,
            }),
            SimpleNode::List(items) => {
                for item in items {
                    appearances.append(&mut collect_links_from_nodes(item));
                }
            }
            SimpleNode::Template { name, .. } => match appearances.last_mut() {
                Some(mut appearance) => {
                    if let None = appearance.templates {
                        appearance.templates = Some(Vec::new());
                    };
                    appearance
                        .templates
                        .as_mut()
                        .unwrap()
                        .push(name.to_string());
                }
                None => {} // This happens for non-link appearances that have a template
            },
            _ => (),
        }
    }
    appearances
}

fn parse_wikitext(cx: &mut FunctionContext) -> NeonResult<Vec<SimpleNode>> {
    let wikitext = cx.argument::<JsString>(0)?.value(cx);
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

    Ok(parse_nodes(&result.nodes, &wikitext))
}

fn parse(mut cx: FunctionContext) -> JsResult<JsValue> {
    let parsed = parse_wikitext(&mut cx)?;

    Ok(neon_serde3::to_value(&mut cx, &parsed)
        .or_else(|e| cx.throw_error(e.to_string()))
        .unwrap())
}

fn parse_appearances(mut cx: FunctionContext) -> JsResult<JsValue> {
    let parsed = parse_wikitext(&mut cx)?;

    let mut ret = Appearances {
        nodes: parsed,
        links: HashMap::new(),
    };
    if let SimpleNode::Template { parameters, .. } = &ret.nodes[0] {
        for param in parameters {
            if let Some(name) = &param.name {
                ret.links
                    .insert(name.to_string(), collect_links_from_nodes(&param.value));
            } else {
                return cx.throw_error("Incorrect input. Template parameter name was expected. (App had an unnamed parameter)");
            }
        }
    } else {
        return cx.throw_error("Incorrect input. Template node was expected.");
    }

    Ok(neon_serde3::to_value(&mut cx, &ret)
        .or_else(|e| cx.throw_error(e.to_string()))
        .unwrap())
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("parse", parse)?;
    cx.export_function("parse_appearances", parse_appearances)?;
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

    #[test]
    fn test_1stid() {
        let wt = "{{App
|c-characters=
*[[1138 (Geonosis)|1138]] {{1st}}
*[[Chian]] {{1st}}
*[[COO-2180]] {{1st}}
*[[Cordé]] {{1st}}
*[[CT-411]] \"Ponds\" {{1st}}
*[[Theomet Danlé]] {{1st}}
*[[Braata Danlos]] {{1st}} {{C|Statue only}}
*[[Oakie Dokes]] {{1st}}
*[[Lexi Dio]] {{1st}}
*[[Tox Don]] {{1stID|Tox Don}}
|c-events=
*[[Clone Wars]] {{1st}}
**[[Battle of Geonosis]] {{1st}} {{C|[[link]]}}
}}";
        let parsed = parse_nodes(&Configuration::default().parse(wt).nodes, wt);
        if let SimpleNode::Template { name, parameters } = &parsed[0] {
            for param in parameters {
                dbg!(&param.name, collect_links_from_nodes(&param.value));
            }
        }
    }
}
