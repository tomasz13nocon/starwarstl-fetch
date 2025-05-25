#![allow(dead_code, unused_imports)]
use core::time;
use std::{cmp::min, collections::HashMap, env, fmt::Write, fs, sync::LazyLock, thread, time::Duration};

use clap::{Parser, ValueEnum};
use error::{Error, Result};
use html_escape::decode_html_entities;
use indicatif::{MultiProgress, ProgressBar, ProgressState, ProgressStyle};
use indicatif_log_bridge::LogWrapper;
use log::{error, info, warn};
use mongodb::{bson::Document, Client};
use parse_wiki_text::{Configuration, Node, TableRow};
use serde::{Deserialize, Serialize};

mod error;
mod model;

#[derive(ValueEnum, Clone)]
enum Timeline {
    Canon,
    Legends,
}

#[derive(Parser)]
#[command(version, about, long_about=None   )]
struct Args {
    #[arg(value_enum)]
    timeline: Timeline,

    #[arg(short, long)]
    cache: bool,
}

fn log_test() {
    let mut downloaded = 0;
    let total_size = 23123131;

    let pb = ProgressBar::new(total_size);
    pb.set_style(
        ProgressStyle::with_template(
            "{spinner:.green} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {bytes}/{total_bytes} ({eta})",
        )
        .unwrap()
        .with_key("eta", |state: &ProgressState, w: &mut dyn Write| {
            write!(w, "{:.1}s", state.eta().as_secs_f64()).unwrap()
        })
        .progress_chars("#>-"),
    );

    while downloaded < total_size {
        let new = min(downloaded + 223211, total_size);
        downloaded = new;
        pb.set_position(new);
        thread::sleep(Duration::from_millis(12));
    }

    pb.finish_with_message("downloaded");
}

fn log_test2() {
    let logger = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).build();
    let level = logger.filter();
    let multi = MultiProgress::new();

    LogWrapper::new(multi.clone(), logger).try_init().unwrap();
    log::set_max_level(level);

    let pg = multi.add(ProgressBar::new(30));

    pg.set_style(
        ProgressStyle::with_template("[{elapsed_precise}] {bar:40.cyan/blue} {pos:>7}/{len:^7} {msg}").unwrap(),
    );

    for i in 0..30 {
        std::thread::sleep(Duration::from_millis(100));
        info!("iteration {}", i);
        pg.inc(1);
    }
    pg.finish();
    multi.remove(&pg);
}

fn log_test3() {
    env_logger::init();
    info!("xdd");
    warn!("xdd");
    error!("xdd");
    let bar = ProgressBar::new(100);
    for i in 0..100 {
        bar.inc(1);
        if i % 10 == 0 {
            info!("hey :)");
        }
        thread::sleep(time::Duration::from_millis(10));
    }
    bar.finish();
}

macro_rules! ensure {
    ($condition:expr, $error_value:expr) => {
        if !($condition) {
            return Err($error_value);
        }
    };
}

fn validate_timeline_header(header: &TableRow) -> Result<()> {
    let expected_columns = ["Year", "", "Title", "Released"];

    ensure!(
        header.cells[1].content.is_empty(),
        Error::TimelineParsing("column 1 must be empty".to_string())
    );
    for (i, expected_column) in expected_columns.iter().enumerate() {
        ensure!(
            header.cells.len() == 4,
            Error::TimelineParsing(format!("expected 4 header cells, found {}", header.cells.len()))
        );
        if i == 1 {
            continue;
        }
        if let Node::Text { value, .. } = header.cells[i].content[0] {
            ensure!(
                value == *expected_column,
                Error::TimelineParsing(format!("column {} must be '{}'", i, expected_column))
            );
        } else {
            return Err(Error::TimelineParsing(format!(
                "column {} was expected, but non text node was found",
                expected_column
            )));
        }
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // let wt = fs::read_to_string("../debug/force-storm.wiki").expect("");
    // let html = fs::read_to_string("../debug/test").expect("");
    // let code = Wikicode::new(&html);

    // let res = reqwest::get("https://starwars.fandom.com/api.php?action=visualeditor&paction=parse&format=json&page=The_High_Republic_—_The_Blade_1").await.unwrap().json::<VisualEditorResponse>().await.unwrap();
    // let html = &res.visualeditor.content;
    // let code = Wikicode::new(html);

    // let templates = code.filter_templates().unwrap();
    //
    // println!("{} templates found", templates.len());
    // for template in templates {
    //     // println!("{}", template.name());
    //     if template.name() == "Template:Comic book" {
    //         let cover_artist = template.param("cover artist").unwrap();
    //         println!("{cover_artist}");
    //
    //         let nodes = Configuration::default().parse(&cover_artist).nodes;
    //
    //         println!("{} nodes in cover_artist", nodes.len());
    //
    //         if let Node::UnorderedList { items, .. } = &nodes[0] {
    //             for node in &items[0].nodes {
    //                 if let Node::Link { target, .. } = node {
    //                     println!("{}", target);
    //                 }
    //             }
    //         }
    //     }
    // }

    // let args = Args::parse();

    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_target(false)
        .init();
    // log_test();
    // log_test2();
    // log_test3();

    // Validate env vars
    _ = dotenvy::dotenv();
    let mongo_uri = env::var("MONGO_URI").expect("MONGO_URI must be set");
    // println!("MONGO_URI: {mongo_uri}");

    // DB
    // let client = Client::with_uri_str(mongo_uri)
    //     .await
    //     .expect("MONGO_URI must be a valid connection string");
    //
    // let m = client
    //     .database("starwarstl")
    //     .collection::<Media>("media")
    //     .find_one(Document::new())
    //     .await
    //     .unwrap()
    //     .unwrap();
    //
    // println!("{m:?}");
    //
    // client.shutdown().await;

    // STEPS
    // Read all template names
    // fetch their revs
    // fetch those that were updated
    // (fetch revs of images...)

    // Parse timeline
    let wt = fs::read_to_string("../debug/timeline").expect("");
    let timeline_nodes = Configuration::default().parse(&wt).nodes;

    let tables = find_tables(timeline_nodes);
    info!("{} tables found", tables.len());

    let table = &tables[1];

    if let Node::Table { rows, .. } = table {
        info!("{} rows in the table", rows.len());
        let header = &rows[0];
        validate_timeline_header(header)?;

        for row in &rows[1..10] {
            if row.cells.len() != 4 {
                return Err(Error::TimelineParsing(
                    "timeline table rows should have exactly 4 cells".to_string(),
                ));
            }

            let year = reduce_nodes_to_text(&row.cells[0].content);
            let title = parse_title(&row.cells[2].content);
            // let title = decode_html_entities(&title_raw);
            println!("{title:#?}");
            let release_date = reduce_nodes_to_text(&row.cells[3].content);

            // println!("{year} {title} {release_date}");

            let media_type_cell = &row.cells[1].content;
            if media_type_cell.len() != 1 || !matches!(media_type_cell[0], Node::Text { .. }) {
                panic!("media type cell should contain a signle text node");
            }
            if let Node::Text { value, .. } = media_type_cell[0] {
                println!("{value}");
            } else {
                unreachable!();
            }
        }
    } else {
        unreachable!("find_tables should only return Node::Table variants");
    }

    Ok(())
}

fn find_tables(nodes: Vec<Node>) -> Vec<Node> {
    let mut tables: Vec<Node> = Vec::new();

    for node in nodes {
        if let Node::Table { .. } = node {
            tables.push(node)
        }
    }

    tables
}

fn get_single_text_node(nodes: &Vec<Node>) -> String {
    match nodes.as_slice() {
        [Node::Text { value, .. }] => (*value).to_string(),
        _ => panic!("Expected exactly one Node::Text variant, got {nodes:#?}"),
    }
}

fn parse_title(nodes: &Vec<Node>) {
    for node in nodes {
        match node {
            Node::Template { name, parameters, .. } => {
                let name = get_single_text_node(name);
                if name == "StoryCite" {
                    println!("{parameters:#?}");
                }
            }
            Node::Text { value, .. } => {
                println!("TEXT: {value:?}");
            }
            _ => {
                panic!("Expected template");
            }
        }
    }
}

fn reduce_nodes_to_text(nodes: &Vec<Node>) -> String {
    nodes
        .iter()
        .map(|node| match node {
            Node::Text { value, .. } => value.to_owned().to_owned(),
            Node::Link { target, text, .. } => reduce_nodes_to_text(text).to_string(),
            Node::Template { name, parameters, .. } => {
                // if name == "StoryCite" {
                // println!("TEMPLATE: {name:?} PARAMS: {parameters:?}");
                let reduced = reduce_nodes_to_text(name);
                let name = match name.as_slice() {
                    [Node::Text { value, .. }] => *value,
                    _ => panic!("Expected exactly one Node::Text variant, got {name:#?}"),
                };

                // println!("{reduced:#?} {name:#?}");
                // }
                String::from("")
            }
            _ => String::from(""),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_release_dates() {
        // ISO 8601
        // 1993-01-XX
        // 1999-XX-XX
        // 2011-12
        // 2012
        // empty
    }
}
