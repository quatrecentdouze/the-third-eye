---
trigger: always_on
---

````md
# Comment Policy (Critical-Only)

This repository follows a **Critical-Only** commenting policy.

## Goal
Comments must exist **only** when they prevent misunderstanding that could lead to:
- a bug,
- a wrong refactor,
- a misuse of an API,
- a broken invariant/assumption,
- a platform-specific mistake,
- a security/performance regression.

If a comment does not reduce the risk of future incorrect changes, **do not write it**.

---

## Allowed comments (write these)
Write a comment **only** for one of these reasons:

1) **Non-obvious behavior / trap**
- API quirks, counterintuitive semantics, “looks wrong but is right”.
- Example: Windows `GetSystemTimes()` kernel time includes idle.

2) **Invariants / constraints**
- “Must be called before X”, “must be monotonic”, “must remain lock-free”, etc.
- Range/units that are easy to misinterpret (ms vs ns, percent 0–100, etc.).

3) **Reason for a seemingly odd choice**
- Why we use a baseline on first call, why we store previous values, why we avoid a simpler approach.

4) **Edge cases**
- First iteration behavior, overflow risks, thread-safety expectations, failure modes.

5) **Compatibility / portability constraints**
- OS-specific differences, compiler workarounds, ABI concerns.

6) **Security-critical notes**
- Sanitization requirements, trust boundaries, “never log secrets”, etc.

---

## Forbidden comments (do NOT write these)
Do not write comments that are:
- **Cosmetic/readability** headings: `// Core count`, `// CPU times`, `// Factory function`, etc.
- **Narrating the code**: “Get system info”, “Compute usage”.
- **Redundant**: restating what the code already says clearly.
- **Namespace closing labels** (e.g. `} // namespace foo`) unless the scope is very long or nested.

---

## Style rules
- Prefer **short, factual** comments.
- Place the comment **exactly where the mistake would happen**.
- Explain **the why**, not the what.
- Avoid jokes, filler, and “documentation-as-prose”.
- If the comment can’t be written in one or two lines, reconsider the code structure first.

---

## Example (what we WANT)

### Good: prevents wrong refactor
```cpp
uint64_t total = d_kernel + d_user;  // Windows: kernel includes idle time
````

### Good: explains baseline / first-call behavior

```cpp
/// Uses deltas between consecutive GetSystemTimes() calls.
/// First call only sets the baseline; usage is reported from the second call.
```

## Example (what we DO NOT want)

### Bad: cosmetic/section labeling

```cpp
// CPU times
// Core count
```

### Bad: restates obvious code

```cpp
// Register metrics
// Compute usage percentage
```

### Bad: namespace closing label in short files

```cpp
} // namespace third_eye
```

---

## Review rule of thumb

If removing the comment would **not** increase the chance of a bug or incorrect change,
the comment should not exist.

```
