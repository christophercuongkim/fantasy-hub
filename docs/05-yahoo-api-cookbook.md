# Yahoo Fantasy API Cookbook

Yahoo's official docs are thin and partly stale. This documents the actual request/response shapes you'll hit, and the normalized output to target.

**The core problem:** Yahoo's JSON is XML converted mechanically. You get objects keyed by stringified integers, `count` siblings instead of array lengths, and metadata interleaved with data in positional arrays. Every response needs normalization.

---

## 1. Setup

### 1.1 Register the app

At `developer.yahoo.com/apps/create`:

| Field | Value |
|---|---|
| Application Name | anything |
| Application Type | Web Application |
| Redirect URI | `https://fantasy.yourdomain.com/api/auth/yahoo/callback` |
| API Permissions | **Fantasy Sports → Read** |

**The redirect URI must match exactly** — protocol, host, path, no trailing slash. Yahoo rejects HTTP except for `localhost`, so use your real domain from the start (see the deployment section of the main plan).

You receive a Client ID (long) and Client Secret.

### 1.2 OAuth2 flow

**Step 1 — consent redirect:**

```
https://api.login.yahoo.com/oauth2/request_auth
  ?client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &language=en-us
```

**Step 2 — exchange code for tokens:**

```http
POST https://api.login.yahoo.com/oauth2/get_token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

grant_type=authorization_code
&redirect_uri={REDIRECT_URI}
&code={CODE}
```

Response:

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "expires_in": 3600,
  "token_type": "bearer",
  "xoauth_yahoo_guid": "…"
}
```

**Step 3 — refresh (hourly):**

```http
POST https://api.login.yahoo.com/oauth2/get_token
Authorization: Basic {base64(client_id:client_secret)}

grant_type=refresh_token
&redirect_uri={REDIRECT_URI}
&refresh_token={REFRESH_TOKEN}
```

**Notes:**

- `redirect_uri` is required on refresh too, even though nothing is redirected. Omitting it returns an opaque error.
- Refresh tokens are long-lived but **not permanent**. They can be revoked by password change or Yahoo policy. Handle re-consent gracefully.
- Store the refresh token in Postgres, not an env var — it needs rotating without a redeploy.

### 1.3 Client design

```python
class YahooClient:
    def get(self, path, params=None):
        # 1. ensure access token valid (refresh if <60s remaining)
        # 2. GET {BASE}{path}?format=json&{params}
        # 3. on 401: refresh once, retry once
        # 4. on 999: back off — Yahoo's rate-limit signal
        # 5. archive raw response to Parquet
        # 6. return normalized dict
```

**HTTP 999 is Yahoo's undocumented rate-limit response.** Not 429. Treat it as a signal to back off exponentially. There's no documented limit; conservative polling (≥5s between calls) has been reliable in practice.

---

## 2. Response shape

### 2.1 The pattern

Everything nests under `fantasy_content`. Collections become integer-keyed objects with a `count`:

```json
{
  "fantasy_content": {
    "users": {
      "0": {
        "user": [
          { "guid": "ABC123" },
          {
            "games": {
              "0": { "game": [ { "game_key": "461", "name": "Football" } ] },
              "count": 1
            }
          }
        ]
      },
      "count": 1
    }
  }
}
```

**Three rules:**

1. **Collections are objects, not arrays.** Iterate `0..count-1`, skipping the `count` key.
2. **Entities are positional arrays**, mixing metadata objects and sub-collections. `player[0]` is metadata, `player[1]` might be stats.
3. **Metadata arrays are themselves arrays of single-key objects.** `[{"player_key": "…"}, {"player_id": "…"}]` rather than one merged object.

### 2.2 Generic normalizer

```python
def flatten_meta(arr):
    """[{a:1},{b:2}] -> {a:1, b:2}; passes dicts through."""
    out = {}
    for item in arr:
        if isinstance(item, dict):
            out.update(item)
    return out

def iter_collection(obj):
    """Yield values from a Yahoo integer-keyed collection."""
    if not isinstance(obj, dict):
        return
    for k, v in obj.items():
        if k == "count":
            continue
        yield v
```

Write these once. Every endpoint parser builds on them.

---

## 3. Endpoints

Base: `https://fantasysports.yahooapis.com/fantasy/v2`
**Always append `?format=json`.**

### 3.1 Current game key

```
GET /game/nfl?format=json
```

```json
{"fantasy_content": {"game": [{
  "game_key": "461", "game_id": "461", "name": "Football",
  "code": "nfl", "type": "full", "season": "2025"
}]}}
```

**Never hardcode the game key.** It changes yearly (2023=423, 2024=449, 2025=461). Fetch it at the start of each session and cache for 24h.

### 3.2 Your leagues

```
GET /users;use_login=1/games;game_keys=nfl/leagues?format=json
```

Path is `users → games → leagues`, each an integer-keyed collection.

**Normalized target:**

```json
[{
  "league_key": "461.l.123456",
  "league_id": "123456",
  "name": "League Name",
  "season": 2025,
  "num_teams": 12,
  "scoring_type": "head",
  "current_week": 7,
  "start_week": 1,
  "end_week": 17,
  "is_finished": false
}]
```

Add `;seasons=2022,2023,2024` to the `games` segment for history — needed for the draft snapshot.

### 3.3 League settings — the important one

```
GET /league/461.l.123456/settings?format=json
```

Raw response is deeply nested; the parts that matter:

```json
{"fantasy_content": {"league": [
  { "league_key": "461.l.123456", "name": "…", "num_teams": 12 },
  { "settings": [{
      "draft_type": "live",
      "is_auction_draft": "0",
      "scoring_type": "head",
      "uses_playoff": "1",
      "playoff_start_week": "15",
      "num_playoff_teams": "6",
      "waiver_type": "FR",
      "uses_faab": "1",
      "trade_end_date": "2025-11-19",
      "roster_positions": [
        {"roster_position": {"position": "QB", "position_type": "O", "count": 1}},
        {"roster_position": {"position": "RB", "position_type": "O", "count": 2}},
        {"roster_position": {"position": "W/R/T", "position_type": "O", "count": 1}},
        {"roster_position": {"position": "BN", "count": 6}}
      ],
      "stat_modifiers": {"stats": [
        {"stat": {"stat_id": "4", "value": "0.04"}},
        {"stat": {"stat_id": "5", "value": "4"}},
        {"stat": {"stat_id": "11", "value": "0.5"}}
      ]}
  }]}
]}}
```

**Stat IDs are opaque integers.** The mapping (NFL):

| stat_id | Meaning | Typical |
|---|---|---|
| 4 | Passing yards | 0.04 |
| 5 | Passing TD | 4 |
| 6 | Interceptions | −1 |
| 9 | Rushing yards | 0.1 |
| 10 | Rushing TD | 6 |
| 11 | Receptions | 0 / 0.5 / 1 |
| 12 | Receiving yards | 0.1 |
| 13 | Receiving TD | 6 |
| 15 | Return TD | 6 |
| 16 | 2-point conversion | 2 |
| 18 | Fumbles lost | −2 |
| 19–28 | Kicking by distance | varies |
| 29–40 | DST categories | varies |

Fetch the authoritative list once from `/game/nfl/stat_categories` and cache it — don't hardcode this table.

**Normalized target:**

```json
{
  "league_key": "461.l.123456",
  "scoring": {
    "pass_yd": 0.04, "pass_td": 4, "pass_int": -1,
    "rush_yd": 0.1, "rush_td": 6,
    "rec": 0.5, "rec_yd": 0.1, "rec_td": 6,
    "fum_lost": -2, "two_pt": 2
  },
  "roster_positions": {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "W/R/T": 1, "K": 1, "DEF": 1, "BN": 6},
  "playoff_start_week": 15,
  "num_playoff_teams": 6,
  "waiver_type": "FAAB",
  "trade_deadline": "2025-11-19"
}
```

`rec: 0.5` versus `rec: 1.0` reorders your entire draft board. **Parse this before anything else.**

### 3.4 Roster

```
GET /team/461.l.123456.t.3/roster;week=7?format=json
```

```json
{"fantasy_content": {"team": [
  [ {"team_key": "461.l.123456.t.3"}, {"name": "Team Name"} ],
  {"roster": {"0": {"players": {
      "0": {"player": [
        [
          {"player_key": "461.p.31883"},
          {"player_id": "31883"},
          {"name": {"full": "Player Name", "first": "…", "last": "…"}},
          {"editorial_team_abbr": "KC"},
          {"display_position": "WR"},
          {"status": "Q"},
          {"injury_note": "shoulder"}
        ],
        {"selected_position": [{"coverage_type": "week"}, {"position": "WR"}]}
      ]},
      "count": 15
  }}}}
]}}
```

Note `player[0]` is the metadata array and `player[1]` holds `selected_position`. Index positions are **not stable across endpoints** — always search by key rather than assuming an index.

**Normalized target:**

```json
[{
  "yahoo_player_id": "31883",
  "player_key": "461.p.31883",
  "name": "Player Name",
  "team": "KC",
  "position": "WR",
  "slot": "WR",
  "status": "Q",
  "injury_note": "shoulder",
  "is_starter": true
}]
```

**`status` values:** `null` (healthy), `Q`, `D`, `O`, `IR`, `IR-R`, `PUP`, `SUSP`, `NA`, `BYE`.

### 3.5 Matchups

```
GET /team/461.l.123456.t.3/matchups;weeks=7?format=json
```

Deeply nested: `team → matchups → matchup → teams → team → team_points`.

**Normalized target:**

```json
[{
  "week": 7,
  "is_playoffs": false,
  "teams": [
    {"team_key": "461.l.123456.t.3", "name": "…", "points": 0.0, "projected_points": 118.4},
    {"team_key": "461.l.123456.t.8", "name": "…", "points": 0.0, "projected_points": 112.7}
  ]
}]
```

Yahoo's `projected_points` is their own projection. Store it — it's a useful comparison for your model diagnostics.

### 3.6 Free agents

```
GET /league/461.l.123456/players;status=FA;sort=AR;count=25;start=0?format=json
```

| Param | Values |
|---|---|
| `status` | `FA` (free agent), `W` (waivers), `T` (taken), `A` (all available) |
| `sort` | `AR` (actual rank), `OR` (overall rank), `PTS`, `PR` (projected rank) |
| `position` | `QB`, `RB`, `WR`, `TE`, `K`, `DEF`, `W/R/T` |
| `count` | max 25 per request |
| `start` | offset for pagination |

**Pagination is 25 at a time.** For a full sweep you'll make ~15 requests. Space them ≥1s apart and cache for 15 minutes.

### 3.7 Draft results

```
GET /league/461.l.123456/draftresults?format=json
```

```json
{"fantasy_content": {"league": [
  {"league_key": "461.l.123456"},
  {"draft_results": {
    "0": {"draft_result": {
      "pick": 1, "round": 1,
      "team_key": "461.l.123456.t.7",
      "player_key": "461.p.32671"
    }},
    "count": 180
  }}
]}}
```

Clean by Yahoo standards. For auction leagues each result also carries `cost`.

**Historical seasons** need that season's game key:

```
GET /league/449.l.123456/draftresults?format=json   # 2024
```

**The league ID usually stays the same across seasons; the game key changes.** If your commissioner recreates the league rather than renewing, the ID changes too and history is lost — which is why the main plan puts this snapshot in Phase 1.

### 3.8 Player stats

```
GET /league/461.l.123456/players;player_keys=461.p.31883/stats;type=week;week=7?format=json
```

Returns stats keyed by `stat_id`, matching the scoring settings table. `type` accepts `week`, `season`, `lastweek`, `lastmonth`.

Batch up to 25 player keys per request with commas.

---

## 4. Gotchas

**Player keys are game-scoped.** `461.p.31883` (2025) and `449.p.31883` (2024) refer to the same player, but the full key differs. Store the bare `player_id` (`31883`) and reconstruct keys as needed.

**Team keys change yearly** for the same reason.

**`count` can lie.** For collections filtered server-side, `count` sometimes reflects the pre-filter total. Trust the actual number of integer keys.

**Empty collections vary.** Sometimes `{"count": 0}`, sometimes the key is absent entirely. Handle both.

**Numbers arrive as strings.** `"num_teams": "12"`, not `12`. Coerce in the normalizer, or type errors will surface deep in the model code.

**Positions are inconsistent.** `display_position` may be `"WR,RB"` for multi-eligible players. `primary_position` is single-valued. Use `primary_position` for modeling, `eligible_positions` for lineup legality.

**DST are pseudo-players.** They have player IDs but no `gsis_id`. Handle team defenses as a separate entity type in the crosswalk.

**Week boundaries.** `current_week` advances Tuesday morning ET, but the exact time varies. Derive week boundaries from your schedule table, not from Yahoo's `current_week`.

**Timezone.** All Yahoo dates are US Eastern with no timezone marker. Convert to UTC on ingest.

---

## 5. Fixtures

Save one real response per endpoint under `contracts/fixtures/yahoo/`:

```
contracts/fixtures/yahoo/
  game_nfl.json
  users_leagues.json
  league_settings.json
  team_roster_week7.json
  team_matchups_week7.json
  league_players_fa.json
  league_draftresults.json
  league_draftresults_2024.json
  player_stats_week7.json
  error_401.json
  error_999.json
```

**These serve three purposes:**

1. Normalizer tests run without network access.
2. The whole UI can be built offline against fixtures.
3. When Yahoo changes shape, a diff against the fixture tells you exactly what moved.

Scrub the GUID and any personal identifiers before committing.

---

## 6. Normalization test targets

Assert these in tests:

| Input | Expected output |
|---|---|
| `{"count": 0}` | `[]` |
| Missing collection key | `[]` |
| `"12"` (string number) | `12` (int) |
| `"0.04"` | `0.04` (float) |
| `status: null` | `"healthy"` |
| `display_position: "WR,RB"` | `["WR", "RB"]` |
| Eastern date string | UTC `timestamptz` |
| Missing `cost` in snake draft | `null`, not `0` |

The `"12"` → `12` coercion is the one that bites hardest — string numbers propagate silently until something does arithmetic and produces `"1212"` instead of `24`.
