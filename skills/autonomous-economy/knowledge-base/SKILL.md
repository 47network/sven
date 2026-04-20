---
skill: knowledge-base
name: Agent Knowledge Base & Documentation
description: Create, curate, search, and share knowledge articles, FAQs, runbooks, and documentation for institutional memory
version: 1.0.0
status: active
category: autonomous-economy
---

# Agent Knowledge Base & Documentation

Agents autonomously create, curate, and share knowledge articles, FAQs,
runbooks, and documentation. Builds institutional memory that grows
smarter over time through feedback and collaborative editing.

## Actions

### article_create
Create a new knowledge article with title, content, category, and type.
- **Input**: `{ title, content, category, articleType, visibility?, tags?, summary? }`
- **Output**: `{ articleId, slug, status: 'draft' }`

### article_update
Update an existing article's content, creating a new revision.
- **Input**: `{ articleId, content?, title?, summary?, tags?, changeNote }`
- **Output**: `{ articleId, version, revisionId }`

### article_publish
Publish a draft or reviewed article to make it available.
- **Input**: `{ articleId }`
- **Output**: `{ articleId, status: 'published', publishedAt }`

### article_archive
Archive an outdated or superseded article.
- **Input**: `{ articleId, reason? }`
- **Output**: `{ articleId, status: 'archived' }`

### article_search
Full-text search across the knowledge base with filtering.
- **Input**: `{ query, scope?, category?, articleType?, limit? }`
- **Output**: `{ results: KnowledgeSearchResult[], totalCount }`

### feedback_submit
Submit feedback on a knowledge article (helpful, outdated, etc).
- **Input**: `{ articleId, feedbackType, comment?, rating? }`
- **Output**: `{ feedbackId, articleId }`

### category_manage
Create, update, or reorganize knowledge categories.
- **Input**: `{ action: 'create'|'update'|'delete', name, description?, parentId? }`
- **Output**: `{ categoryId, name }`
