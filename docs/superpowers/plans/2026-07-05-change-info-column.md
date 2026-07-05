# Change Info Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the instrument change status out of the certificate-number cell into a separate table column named “变更信息”.

**Architecture:** Keep the existing API fields and history drawer flow unchanged. Add a source-structure regression test for the Vue template, then split the existing certificate cell markup into two adjacent Element Plus table columns and retain the current click handlers.

**Tech Stack:** Vue 3 SFC, Element Plus, Node.js built-in test runner, Vite

---

### Task 1: Split the table columns

**Files:**
- Create: `client/src/views/InstrumentList.test.js`
- Modify: `client/src/views/InstrumentList.vue:352-364`

- [x] **Step 1: Write the failing structure test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./InstrumentList.vue', import.meta.url), 'utf8')

test('renders change status in a separate change-info column', () => {
  const certificateStart = source.indexOf('label="证书编号"')
  const changeInfoStart = source.indexOf('label="变更信息"')
  const inspectionStart = source.indexOf('prop="inspection_date"')

  assert.ok(certificateStart >= 0)
  assert.ok(changeInfoStart > certificateStart)
  assert.ok(inspectionStart > changeInfoStart)

  const certificateColumn = source.slice(certificateStart, changeInfoStart)
  const changeInfoColumn = source.slice(changeInfoStart, inspectionStart)
  assert.doesNotMatch(certificateColumn, /latest_change_at|已更新|change-meta/)
  assert.match(changeInfoColumn, /latest_change_at/)
  assert.match(changeInfoColumn, /已更新/)
  assert.match(changeInfoColumn, /latest_change_summary/)
  assert.match(changeInfoColumn, /openHistory\(row\)/)
})
```

- [x] **Step 2: Run the test and verify RED**

Run: `node --test client/src/views/InstrumentList.test.js`

Expected: FAIL because `label="变更信息"` does not exist.

- [x] **Step 3: Implement the independent column**

Replace the current certificate column with adjacent certificate and change-info columns. The certificate column contains only the number. The change-info column contains the existing tag and metadata button when `latest_change_at` exists, and `-` otherwise.

```vue
<el-table-column prop="certificate_number" label="证书编号" width="180" show-overflow-tooltip>
  <template #default="{ row }">
    <span class="cert-number">{{ row.certificate_number || '-' }}</span>
  </template>
</el-table-column>

<el-table-column label="变更信息" width="230">
  <template #default="{ row }">
    <div v-if="row.latest_change_at" class="change-info-cell">
      <el-tag type="success" size="small" class="updated-tag" @click.stop="openHistory(row)">已更新</el-tag>
      <button class="change-meta" type="button" @click.stop="openHistory(row)">
        {{ formatDateTime(row.latest_change_at) }}<template v-if="row.latest_change_summary"> · {{ row.latest_change_summary }}</template>
      </button>
    </div>
    <span v-else>-</span>
  </template>
</el-table-column>
```

Replace obsolete certificate wrapper styles with:

```css
.change-info-cell { min-width: 0; }
.updated-tag { flex-shrink: 0; cursor: pointer; }
```

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `node --test client/src/views/InstrumentList.test.js client/src/utils/instrumentHistory.test.js`

Expected: all tests PASS.

- [x] **Step 5: Build the frontend**

Run: `npm --prefix client run build`

Expected: Vite production build succeeds without template or CSS errors.

- [x] **Step 6: Review the diff**

Run: `git diff --check && git diff -- client/src/views/InstrumentList.vue client/src/views/InstrumentList.test.js`

Expected: no whitespace errors; diff contains only the column split, focused test, and obsolete style cleanup.
