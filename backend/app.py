from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from azure.core.credentials import AzureKeyCredential
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
import os
import json
import re
from dotenv import load_dotenv
import time

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Azure Inference API config
endpoint = "https://models.inference.ai.azure.com"
model_name = "Meta-Llama-3.1-405B-Instruct"
token = os.getenv("TOKEN")
print("Token loaded:", bool(token))
client = ChatCompletionsClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(token),
)

class CodeRequest(BaseModel):
    code: str

async def call_model(system: str, user: str, max_tokens: int = 1000) -> str:
    start_time = time.time()
    response = client.complete(
        messages=[
            SystemMessage(system),
            UserMessage(user),
        ],
        temperature=0.3,  # lower randomness for repeatable structure
        top_p=0.9,
        max_tokens=max_tokens,
        model=model_name,
    )
    print(f"🔍 LLM call took {round(time.time() - start_time, 2)}s")
    return response.choices[0].message.content.strip()

@app.get("/")
def index():
    return {"message": "Welcome to the Code Analysis API!"}, 200

@app.post("/analyze")
async def analyze_code(request: CodeRequest):
    system = "You are a helpful assistant."
    user = f"""
You are an experienced cybersecurity analyst. Analyze the provided code specifically for severe security vulnerabilities. Only identify vulnerabilities that pose real-world threats, such as:

- SQL Injection
- Command Injection
- Hardcoded sensitive information (passwords or credentials)
- Authentication/Authorization issues

Provide output strictly in the following JSON format, reporting only real, actionable security vulnerabilities:

{{
    "vulnerabilities": [
        {{
            "line": line_number,
            "severity": "high/medium/low",
            "type": "vulnerability",
            "description": "specific, actionable description of the security issue"
        }}
    ]
}}

Important guidelines:
- Do include minor code-quality issues, typos, or non-critical problems.
- Prioritize accuracy and relevance. If unsure about a vulnerability, omit it.
- Focus only on clear, severe security vulnerabilities.
- If no severe security vulnerabilities exist, respond exactly with: {{"vulnerabilities": []}}

Here is the code for analysis:

{request.code}
"""
    try:
        response = await call_model(system, user)
        print("RAW ANALYZE RESPONSE:", response)

        cleaned = re.sub(r"\[\d{4}-\d{2}-\d{2}T.*?\] ?", "", response)
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            vulnerabilities = json.loads(match.group(0))
        else:
            vulnerabilities = {"vulnerabilities": []}
    except json.JSONDecodeError as e:
        print("❌ JSON Decode Error:", e)
        vulnerabilities = {"vulnerabilities": []}

    return vulnerabilities

@app.post("/complexity")
async def calculate_complexity(request: CodeRequest):
    system = "You are a helpful assistant."
    user = f"""
Analyze the provided code snippet for complexity strictly using the following rules:

Lines of Code (LOC):
- < 100 lines: Low Complexity
- 100–500 lines: Medium Complexity
- > 500 lines: High Complexity

Maintainability (Code Smells):
- A (0–5%): Very Low Technical Debt
- B (6–10%): Low Technical Debt
- C (11–20%): Moderate Technical Debt
- D (21–50%): High Technical Debt
- E (>50%): Very High Technical Debt

Cyclomatic Complexity, Cognitive Complexity, NPath Complexity rules:
- If/Else Condition: +1 Cyclomatic, +1 Cognitive, doubles NPath
- For/While/Do-While Loop: +1 Cyclatic, +1 Cognitive, multiplies NPath
- Switch Case: +1 Cyclomatic per case, +1 Cognitive, adds NPath
- Ternary Operator: +1 Cyclomatic, +1 Cognitive, doubles NPath
- Recursion: +1 Cyclomatic, +1 Cognitive, high NPath
- Lambda/Closure: +1 Cyclomatic, +1 Cognitive

Provide output strictly in the following JSON format:
{{
    "summary": {{
        "lines_of_code": "Low/Medium/High",
        "maintainability": "A/B/C/D/E",
        "cyclomatic_complexity": integer,
        "cognitive_complexity": integer,
        "npath_complexity": "Low/Medium/High"
    }}
}}

Here is the code snippet:
{request.code}
"""
    try:
        response = await call_model(system, user)
        print("RAW COMPLEXITY RESPONSE:", response)

        match = re.search(r"\{[\s\S]*\}", response)
        if match:
            complexity_summary = json.loads(match.group(0))
        else:
            complexity_summary = {"summary": {}}
    except json.JSONDecodeError as e:
        print("❌ JSON Decode Error:", e)
        complexity_summary = {"summary": {}}

    return complexity_summary

@app.post("/refactor")
async def refactor_code(request: CodeRequest):
    system = "You are a helpful assistant."
    user = f"""
You are an expert developer. Your task is to refactor the following code snippet to achieve the lowest complexity, strictly following these rules:

- Minimize Cyclomatic, Cognitive, and NPath complexities.
- Remove any duplication of logic.
- Optimize code maintainability and readability.
- Preserve the exact original functionality.
- Ensure the refactored code is fully functional and syntactically correct.

Important:
- Provide only the complete, functional, and self-contained refactored code.
- Do NOT include explanations, additional markdown, or redundant code blocks.

Refactor this code:

{request.code}
"""
    optimized_code = await call_model(system, user, max_tokens=1500)

    if optimized_code.startswith("```python"):
        optimized_code = optimized_code[len("```python"):].strip()
    if optimized_code.endswith("```"):
        optimized_code = optimized_code[:-3].strip()

    return {"optimized_code": optimized_code}
