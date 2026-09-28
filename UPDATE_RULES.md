# Gifty Hamper Project Update Rules

## Latest update timestamp
- The file `latest-update.txt` is the single source of truth for the latest project update time.
- The GitHub Actions workflow `.github/workflows/update-latest-timestamp.yml` updates it automatically after every push to `main`.
- Timestamp format: `DD-MM-YYYY HH:MM:SS IST`.
- Do not manually edit `latest-update.txt`.
- The Admin header displays this timestamp as **Latest update: DD-MM-YYYY HH:MM:SS IST**.
- Any future code change pushed to `main` must keep this workflow enabled.
