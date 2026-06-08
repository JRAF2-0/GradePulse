# Screenshots — replacement guide

The 6 PNGs in this folder are **placeholders** referenced from the project [README](../../README.md#screenshots). Replace each one with a real capture from the live app to make the portfolio piece look polished.

## Files and what to capture

| File            | Route                              | What to show                                                                 |
| --------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `login.png`     | `/login` or `/signup`              | Auth screen — the split-screen layout with the brand panel on the side       |
| `student.png`   | `/student`                         | Student dashboard with filled grades, CGPA, Risk badge, Dean's List card     |
| `teacher.png`   | `/teacher/classes/:id`             | Class detail — Grades tab with the weighted-category entry grid              |
| `admin.png`     | `/admin/users`                     | Users page with the role-assignment modal open (showing department picker)   |
| `parent.png`    | `/parent`                          | Parent dashboard with one or two linked-child cards                          |
| `analytics.png` | `/student/analytics`               | Trend line + category breakdown bar + contribution pie all visible           |

## Capture recipe (consistent results)

1. **Browser:** Chrome or Edge in incognito so no extension toolbars/bookmarks leak in.
2. **Window size:** resize to ~**1280×800** before capturing — that matches the placeholder dimensions and the README grid renders evenly.
3. **Theme:** dark mode (the project default). If you want one shot in light mode for variety, swap `analytics.png` to light.
4. **Data:** use a populated demo account (real-looking grades, not all zeros). Empty states look weak in a portfolio.
5. **Crop:** include the sidebar + topbar — that's part of the product's identity. Don't crop them out.
6. **Filename:** save as `<name>.png` exactly matching the table above (case-sensitive on GitHub).

## Tools

- **Free + fast:** Windows `Snipping Tool` (Win+Shift+S) → paste into Paint → save as PNG.
- **Better:** [ShareX](https://getsharex.com/) — region capture with auto-save and naming.
- **Polished (browser frame around the image):** [shots.so](https://shots.so) or [screenshot.rocks](https://screenshot.rocks). Drop your PNG in, pick a laptop/browser frame, export.

## After replacing

```bash
git add docs/screenshots/
git commit -m "Replace placeholder screenshots with live captures"
git push
```

GitHub will re-render the README with the new images within a minute.

## Sizing notes

- The README uses a 2-column markdown table — images render at half the column width on desktop. **1280×800** placeholders downscale cleanly there.
- Don't upload anything above ~500 KB per image; if a capture is huge, run it through [tinypng.com](https://tinypng.com) first.
- Keep all 6 the **same aspect ratio** so the grid stays even.
