# 14 — Architecture

← [Index](README.md) · Prev: [13 Risks](13-risks.md)

Conceptual view. No schemas, endpoints, or libraries. Those live in
[03 Data model](03-data-model.md), [05 Runtime](05-runtime.md), and
[12 Delivery](12-delivery.md).

## Request lifecycle

The shape to notice: **the expensive path and the cheap path diverge before anything costly
happens.** Refusing is free and anonymous. Answering costs money, so it is the only thing gated.

```mermaid
flowchart TD
    V(["Visitor asks a question"]) --> BOT{"Human?"}
    BOT -->|no| DROP["Dropped at the edge"]
    BOT -->|yes| LIM{"Within rate limits?"}
    LIM -->|no| RL["Refuse: too many requests"]
    LIM -->|yes| SEARCH["Search the corpus"]

    SEARCH --> GRADE{"How strong is<br/>the evidence?"}

    GRADE -->|"nothing close"| OFF["Refuse: off topic"]
    GRADE -->|"nearby, but<br/>does not answer"| GAP["Refuse, and offer<br/>to ask Tanish"]
    GRADE -->|"corroborated by<br/>two sources"| KIND{"Cleared prose that<br/>must not be reworded?"}

    KIND -->|yes| QUOTE["Return it verbatim,<br/>with its citation"]
    KIND -->|no| GATE{"Has this visitor used<br/>their free answer?"}

    GATE -->|no| BUDGET
    GATE -->|yes| WHO{"Signed in?"}
    WHO -->|no| SIGNIN["Hold the question,<br/>ask them to sign in"]
    SIGNIN -.->|"identified,<br/>question replayed"| BUDGET
    WHO -->|yes| BUDGET{"Budget remaining?"}

    BUDGET -->|no| CAP["Refuse: daily budget reached"]
    BUDGET -->|yes| GEN["Compose an answer<br/>from the evidence, in voice"]

    GEN --> OUT(["Answer + sources"])
    QUOTE --> OUT
    OFF --> OUTR(["Refusal + reason"])
    RL --> OUTR
    CAP --> OUTR
    GAP --> OUTR

    OUT --> LOG["Record what was read,<br/>what was said, what it cost"]
    OUTR --> LOG

    classDef refuse fill:#3b1f2b,stroke:#a33,color:#f5f5f5
    classDef answer fill:#10233a,stroke:#00d9ff,color:#f5f5f5
    classDef gate fill:#1d1b33,stroke:#6366f1,color:#f5f5f5
    class OFF,GAP,RL,CAP,DROP,OUTR refuse
    class GEN,QUOTE,OUT answer
    class GATE,WHO,SIGNIN,BUDGET gate
```

Three properties the diagram encodes:

1. **Nothing reaches the model without corroborated evidence.** Every path into generation passes
   the grading diamond first.
2. **Refusal is never gated.** No sign-in, no budget check, no cost. A visitor can watch the agent
   decline all day, which is the behavior worth showing.
3. **The sign-in step preserves the question.** It is held and replayed, not discarded.

## What the grading decides

Retrieval always returns something, because every document in the corpus is about the same person.
So the interesting question is never "did we find anything" but "is what we found actually an
answer". Three outcomes, and only one of them is allowed to speak.

```mermaid
flowchart LR
    R["Retrieved passages"] --> D{"Verdict"}
    D -->|"strong<br/>two independent sources agree"| A["Generate"]
    D -->|"weak<br/>the corpus is nearby<br/>but silent on this"| B["Refuse, and treat it<br/>as a content gap"]
    D -->|"none<br/>nothing is close"| C["Refuse as off topic"]

    A --> A1["Answer, cited"]
    B --> B1["Goes to the gap queue"]
    C --> C1["Ends here"]

    classDef ok fill:#10233a,stroke:#00d9ff,color:#f5f5f5
    classDef mid fill:#2b2416,stroke:#c90,color:#f5f5f5
    classDef no fill:#3b1f2b,stroke:#a33,color:#f5f5f5
    class A,A1 ok
    class B,B1 mid
    class C,C1 no
```

The middle band is the whole design. A question about Tanish that the corpus cannot answer still
looks topically related, so a system that answers whenever retrieval returns *something* produces
its most confident wrong claims exactly there. This one refuses instead, and files it.

## The content loop

The gap queue is why the agent gets better without anyone maintaining it. Blind spots become
questions; questions become published answers; published answers become part of what the agent
knows, with no deploy.

```mermaid
flowchart LR
    Q["A question the<br/>corpus cannot answer"] --> N["Tanish is notified"]
    N --> W["He writes the answer"]
    W --> P{"Publish?"}
    P -->|yes| PUB["Published publicly,<br/>answer only"]
    PUB --> C[("Corpus")]
    C --> Q2["Next visitor asking<br/>the same thing gets<br/>a real answer"]
    Q2 -.->|"and the loop<br/>keeps running"| Q

    AUTH["Authored writing"] --> C

    classDef store fill:#1d1b33,stroke:#6366f1,color:#f5f5f5
    class C store
```

Two inlets to the corpus, both human-written: authored prose, and answers to real questions.
Nothing is extracted automatically, which is what keeps the agent from disclosing things the
public pages deliberately abstract away.

## Components

Roles, not vendors. The mapping to providers is in [12 Delivery](12-delivery.md).

```mermaid
flowchart TB
    subgraph client["In the browser"]
        UI["Chat panel"]
    end

    subgraph app["The site"]
        CORE["Agent core:<br/>search, grade,<br/>answer or refuse"]
        ADMIN["Answering tools<br/>reached by emailed link"]
    end

    subgraph data["State"]
        CORPUS[("Corpus and<br/>its search index")]
        RECORD[("Record of every turn:<br/>what was read, said, spent")]
    end

    subgraph out["Outside services"]
        EMB["Text-to-vector service"]
        LLM["Language model"]
        IDP["Identity provider"]
        MAIL["Transactional email"]
    end

    UI <-->|"streams steps,<br/>sources, then text"| CORE
    UI -->|"sign in"| IDP
    CORE --> CORPUS
    CORE --> RECORD
    CORE --> EMB
    CORE -->|"only with<br/>strong evidence"| LLM
    CORE -->|"gap captured"| MAIL
    MAIL --> ADMIN
    ADMIN -->|"publishes an answer"| CORPUS

    classDef store fill:#1d1b33,stroke:#6366f1,color:#f5f5f5
    classDef ext fill:#152028,stroke:#00d9ff,color:#f5f5f5
    class CORPUS,RECORD store
    class EMB,LLM,IDP,MAIL ext
```

Worth noting what is absent: the agent has no tools, no ability to read the repository, and no path
to the internet. Its entire capability is looking things up in the corpus. That is a deliberate
constraint, not a stage of development. See [00 Overview](00-overview.md).

The one asymmetry: **everything the agent reads is human-written, and everything it says is
recorded.** Both directions are auditable, which is the property that makes it safe to point at a
real person's name.
