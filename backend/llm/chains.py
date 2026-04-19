from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from llm.providers import get_llm


def get_triage_chain(provider: str = "openai"):
    llm = get_llm(provider)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Bạn là IT Service Management expert. Phân tích incident và trả về JSON. Nếu có incident tương tự trong context có resolution, hãy đề xuất resolution đó."),
        ("human", """Context từ các incident tương tự trước đây (bao gồm cả cách giải quyết cũ nếu có):
{rag_context}

**Mô tả:** {description}
**Impact:** {impact}

Trả về JSON format:
{{
  "priority": "P1|P2|P3|P4",
  "priority_reason": "lý do ngắn gọn",
  "category": "Application|Network|Database|Security|Infrastructure|Integration|Performance|Access",
  "impact_assessment": {{ "users_affected": "số/scope", "business_impact": "Critical|High|Medium|Low" }},
  "recommended_actions": ["action1", "action2", "action3"],
  "suggested_team": "team phù hợp",
  "suggested_resolution": "đề xuất cách giải quyết dựa trên quá khứ (nếu có)",
  "confidence": 0.0
}}"""),
    ])
    return prompt | llm | JsonOutputParser()


def get_rca_chain(provider: str = "openai"):
    llm = get_llm(provider)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Bạn là IT expert phân tích root cause."),
        ("human", """**Triệu chứng:** {symptoms}
**Logs:** {logs}
**Timeline:** {timeline}

Phân tích và trả về:
## 🔍 ROOT CAUSE ANALYSIS

**Most Likely Root Cause:**
[Mô tả nguyên nhân chính]

**Contributing Factors:**
1. [Factor 1]
2. [Factor 2]

**Evidence:**
- [Evidence từ logs/symptoms]

**Recommended Fix:**
1. Immediate: [action ngay]
2. Short-term: [fix tạm]
3. Long-term: [prevention]

**Confidence:** [0-100]%"""),
    ])
    return prompt | llm | StrOutputParser()


def get_resolution_chain(provider: str = "openai"):
    llm = get_llm(provider)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Bạn là IT Support. Tạo Resolution Summary chuẩn SFDC."),
        ("human", """**Tóm tắt:** {summary}
**Actions taken:** {actions}
**Outcome:** {outcome}

Trả về Resolution Note ngắn gọn, professional:
## ✅ RESOLUTION SUMMARY

**Issue:** [1 dòng tóm tắt issue]

**Root Cause:** [1 dòng nguyên nhân]

**Resolution:**
1. [Step đã làm]
2. [Step đã làm]

**Result:** [Kết quả]

**Prevention:** [Recommendation để tránh tái diễn]"""),
    ])
    return prompt | llm | StrOutputParser()


def get_escalation_chain(provider: str = "openai"):
    llm = get_llm(provider)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Soạn email escalation chuyên nghiệp."),
        ("human", """**Incident ID:** {id}
**Summary:** {summary}
**Escalate to:** {to}
**Urgency:** {urgency}
**Actions done:** {done}
**Request:** {ask}

Trả về email format:
Subject: [Tiêu đề]

[Nội dung email với greeting, context, request, closing]"""),
    ])
    return prompt | llm | StrOutputParser()
