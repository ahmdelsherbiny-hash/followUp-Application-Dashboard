
const fs = require('fs');
const lines = fs.readFileSync('C:/Users/ahmed/.gemini/antigravity/brain/897f03a1-4610-4ef6-950a-bcaf6fc94c22/.system_generated/logs/transcript_full.jsonl', 'utf-8').split('\n');
let lastContent = {};
for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (const call of obj.tool_calls) {
                if (call.name === 'write_to_file' || call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
                    const target = call.args.TargetFile || call.args.AbsolutePath;
                    if (!target) continue;
                    // We only care about edits made BEFORE the continue message!
                    // If we find an edit, we can print it out, but wait, replace_file_content doesn't have the full file!
                }
            }
        }
    } catch(e) {}
}

