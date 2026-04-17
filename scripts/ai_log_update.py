import os
import sys
import json
from datetime import datetime

def main():
    if len(sys.argv) < 2:
        print("Usage: python ai_log_update.py \"Description of what the AI just did\"")
        return

    update_text = sys.argv[1]
    
    docs_dir = os.path.join(os.path.dirname(__file__), '..', 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    json_path = os.path.join(docs_dir, 'project_log.json')
    
    # Load existing
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {"summary": [], "detailed_report": "", "changelog": []}
    else:
        data = {"summary": [], "detailed_report": "", "changelog": []}

    # Append changelog
    data.setdefault("changelog", []).insert(0, {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "update": update_text
    })

    # Keep only last 50 updates so it doesn't bloat forever
    if len(data["changelog"]) > 50:
        data["changelog"] = data["changelog"][:50]

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print("Successfully committed AI task summary to docs/project_log.json")

if __name__ == '__main__':
    main()
