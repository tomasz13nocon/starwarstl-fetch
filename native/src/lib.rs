use neon::prelude::*;
use parse_wiki_text::{Configuration, ListItem, Node};
use serde::Serialize;

#[derive(Serialize, Debug)]
enum SimpleNode {
    List {
        items: Vec<SimpleListItem>,
    },
    Template {
        name: String,
        parameters: Vec<SimpleParameter>,
    },
    Text {
        value: String,
    },
}

#[derive(Serialize, Debug)]
struct SimpleListItem {
    nodes: Vec<SimpleNode>,
}

#[derive(Serialize, Debug)]
struct SimpleParameter {
    name: Option<String>,
    value: String,
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

fn parse_list_items(items: &Vec<ListItem>) -> Vec<SimpleListItem> {
    let mut item_list = Vec::new();
    for item in items {
        let mut node_list = Vec::new();
        for node in &item.nodes {
            match node {
                Node::UnorderedList { items, .. } => {
                    node_list.push(SimpleNode::List {
                        items: parse_list_items(&items),
                    });
                }
                Node::Text { value, .. } => {
                    node_list.push(SimpleNode::Text {
                        value: value.to_string(),
                    });
                }
                Node::Template {
                    name, parameters, ..
                } => {
                    node_list.push(SimpleNode::Template {
                        name: reduce_nodes_to_text(&name),
                        parameters: parameters
                            .iter()
                            .map(|param| SimpleParameter {
                                name: param.name.as_ref().map(|nodes| reduce_nodes_to_text(nodes)),
                                value: reduce_nodes_to_text(&param.value),
                            })
                            .collect(),
                    });
                }
                _ => (),
            };
        }
        item_list.push(SimpleListItem { nodes: node_list });
    }
    item_list
}

fn parse_list(mut cx: FunctionContext) -> JsResult<JsValue> {
    let list_str = cx.argument::<JsString>(0)?.value(&mut cx);
    let result = Configuration::default().parse(&list_str);
    if !result.warnings.is_empty() {
        let erroneous_wt = result
            .warnings
            .iter()
            .map(|warn| &list_str[warn.start..warn.end]).collect::<String>();
        return cx.throw_error(format!(
            "Parsing warnings: {:?}\nErroneous wikitext: {:?}",
            result.warnings, erroneous_wt
        ));
    }

    let ret = match &result.nodes[0] {
        Node::UnorderedList { items, .. } => Ok(SimpleNode::List {
            items: parse_list_items(items),
        }),
        _ => Err("Not a list"),
    };
    // dbg!(ret.unwrap());

    Ok(neon_serde3::to_value(&mut cx, &ret)
        .or_else(|e| cx.throw_error(e.to_string()))
        .unwrap())
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("parse_list", parse_list)?;
    Ok(())
}
