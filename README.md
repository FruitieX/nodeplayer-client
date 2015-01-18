# partyplay-client
simple CLI client for partyplay

usage
-----

### Show queue

* Run program with argument `-l`

### Adding to queue

1. Run a command that produces a song list (e.g. `search, -s` or `list playlist, -p`)
2. Add song to queue from list by id (e.g. `-a 42`)

playlists
---------

Playlists are `.json` files placed into `~/.partyplay-client/playlists/`. The
format looks like this:

```
[
    {
        "album": "AlbumName 1",
        "artist": "ArtistName 1",
        "backendName": "gmusic",
        "duration": "123456",
        "format": "opus",
        "songID": "long-id-here",
        "title": "TitleName 1"
    },
    {
        "album": "AlbumName 2",
        "artist": "ArtistName 2",
        "backendName": "youtube",
        "duration": "123456",
        "format": "mp3",
        "songID": "long-id-here",
        "title": "TitleName 2"
    },
    ...
]
```
