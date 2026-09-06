# Rejected preliminary capture

`benchmark-2026-09-05T11-40-12.343Z.json` completed all six standard legs and
passed the JSON schema, but the capture command returned failure after observing
a browser console 404. Root reproduced the error and identified its exact URL
as `/favicon.ico`; no game asset or JavaScript module failed.

The HTML now declares an inline empty favicon. Keep this original JSON for an
audit trail, but exclude it from the final headline results. Final results use
the subsequent successful, error-free captures in `../metal/` and
`../software/`. The render JavaScript was unchanged by this HTML correction.
