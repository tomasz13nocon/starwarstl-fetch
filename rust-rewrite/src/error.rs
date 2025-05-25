#[derive(Debug)]
pub enum Error {
    TimelineParsing(String),
    Qwe(String),
    UnexpectedWikitextStructure(String),
}

pub type Result<T> = std::result::Result<T, Error>;
