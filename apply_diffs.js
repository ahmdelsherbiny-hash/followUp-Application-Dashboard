const fs = require('fs');
const transcripts = [
    'C:/Users/ahmed/.gemini/antigravity/brain/9f9f1602-5845-4817-86cc-620eae0f58a7/.system_generated/logs/transcript_full.jsonl',
    'C:/Users/ahmed/.gemini/antigravity/brain/e86651cd-0906-401e-9ce0-b64e751150b5/.system_generated/logs/transcript_full.jsonl',
    'C:/Users/ahmed/.gemini/antigravity/brain/897f03a1-4610-4ef6-950a-bcaf6fc94c22/.system_generated/logs/transcript_full.jsonl'
];

for (const t of transcripts) {
    if (!fs.existsSync(t)) continue;
    const lines = fs.readFileSync(t, 'utf-8').split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            
            // Stop processing if we reach the 'continue' message in the current session
            if (obj.type === 'USER_INPUT' && obj.content && obj.content.includes('Continue') && obj.content.includes('7.')) {
                console.log('Found continue message, stopping.');
                process.exit(0);
            }
            
            if (obj.tool_calls) {
                for (const call of obj.tool_calls) {
                    if (call.name === 'write_to_file') {
                        fs.writeFileSync(call.args.TargetFile, call.args.CodeContent, 'utf-8');
                    } else if (call.name === 'replace_file_content') {
                        let content = fs.readFileSync(call.args.TargetFile, 'utf-8');
                        const linesArr = content.split('\n');
                        const start = call.args.StartLine - 1;
                        const end = call.args.EndLine; // exclusive
                        const replaced = call.args.ReplacementContent;
                        linesArr.splice(start, end - start, replaced);
                        fs.writeFileSync(call.args.TargetFile, linesArr.join('\n'), 'utf-8');
                    } else if (call.name === 'multi_replace_file_content') {
                        let content = fs.readFileSync(call.args.TargetFile, 'utf-8');
                        let linesArr = content.split('\n');
                        const chunks = call.args.ReplacementChunks.sort((a, b) => b.StartLine - a.StartLine);
                        for (const chunk of chunks) {
                            const start = chunk.StartLine - 1;
                            const end = chunk.EndLine;
                            const replaced = chunk.ReplacementContent;
                            linesArr.splice(start, end - start, replaced);
                        }
                        fs.writeFileSync(call.args.TargetFile, linesArr.join('\n'), 'utf-8');
                    }
                }
            }
        } catch(e) { }
    }
}
