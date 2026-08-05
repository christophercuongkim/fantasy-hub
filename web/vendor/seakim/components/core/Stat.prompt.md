One measured figure with its label — the unit both apps repeat everywhere.

```jsx
<Stat label="Total fare" value="$412" hint="2 travellers, taxes in" />
<Stat label="Projected" value="18.4" unit="pts" delta="+2.1" size="lg" />
```

Values use IBM Plex Mono with tabular figures so grids of stats align. `align="right"`
inside tables. Green/red on `delta` is the only place status color appears without a
status meaning — it reads as direction, not health.
