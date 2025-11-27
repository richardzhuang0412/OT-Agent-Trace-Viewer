from datasets import load_dataset

dataset = load_dataset("DCAgent2/DCAgent_dev_set_71_tasks_DCAgent2_freelancer-projects-100k-traces_20251124_143851", 
split="train")

import json

row = dataset[0]
print(row)

# Store this row as a JSON file for viewing
with open('sample_trace_row.json', 'w', encoding='utf-8') as f:
    json.dump(row, f, ensure_ascii=False, indent=2)