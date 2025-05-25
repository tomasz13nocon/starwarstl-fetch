use std::{collections::HashMap, sync::LazyLock};

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct VisualEditor {
    result: String,
    etag: String,
    basetimestamp: String,
    starttimestamp: String,
    content: String,
}

#[derive(Deserialize, Debug)]
pub struct VisualEditorResponse {
    visualeditor: VisualEditor,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct IUDate {
    display: String,
    year: i32,
}

pub enum TimelineType {
    Comic,
    Novel,
    Audio,
    ShortStory,
    YoungReader,
    JuniorNovel,
    TV,
    Film,
    VideoGame,
    Rpg,
    Promotional,
    Gamebook,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum MediaType {
    Film,
    TVLiveAction,
    TVAnimated,
    TVMicroSeries,
    VideoGameDesktopConsole,
    VideoGameVR,
    VideoGameMobile,
    VideoGameBrowser,
    NovelAdult,
    NovelYoungAdult,
    NovelJunior,
    AudioDrama,
    Comic,
    ComicManga,
    ComicStrip,
    ComicStory,
    ShortStory,
    YoungReader,
}

pub static TIMELINE_TYPES: LazyLock<HashMap<&str, TimelineType>> = LazyLock::new(|| {
    HashMap::from([
        ("C", TimelineType::Comic),
        ("N", TimelineType::Novel),
        ("A", TimelineType::Audio),
        ("SS", TimelineType::ShortStory),
        ("YR", TimelineType::YoungReader),
        ("JR", TimelineType::JuniorNovel),
        ("TV", TimelineType::TV),
        ("F", TimelineType::Film),
        ("VG", TimelineType::VideoGame),
        ("RPG", TimelineType::Rpg),
        ("P", TimelineType::Promotional),
        ("GB", TimelineType::Gamebook),
    ])
});

#[derive(Serialize, Deserialize, Debug)]
pub struct Media {
    page_id: String,
    title: String,
    type_: MediaType,
    // release_date: N
}
