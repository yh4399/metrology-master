<template>
  <div class="instrument-list-page">
    <!-- 搜索筛选卡片 -->
    <div class="filter-card">
      <div class="filter-header">
        <h4>🔍 筛选条件</h4>
        <div class="filter-header-actions">
          <el-button type="success" @click="photoSearchVisible = true">
            <el-icon><Camera /></el-icon> 拍照查找
          </el-button>
          <el-button type="primary" @click="$router.push('/instruments/add')">
            <el-icon><Plus /></el-icon> 新增器具
          </el-button>
        </div>
      </div>
      <div class="filter-body">
        <div class="filter-row">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索：出厂编号 / 型号 / 厂家 / 位置 / 证书编号"
            clearable
            size="default"
            class="filter-search-input"
            @input="onSearchDebounce"
            @clear="fetchList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-select v-model="filters.category" placeholder="全部类别" clearable size="default" @change="fetchList" style="width:140px;flex-shrink:0">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>

          <el-select v-model="filters.status" placeholder="全部状态" clearable size="default" @change="fetchList" style="width:120px;flex-shrink:0">
            <el-option v-for="opt in STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>

          <el-select v-model="filters.classification" placeholder="全部分类" clearable size="default" @change="fetchList" style="width:110px;flex-shrink:0">
            <el-option label="A 类" value="A" />
            <el-option label="B 类" value="B" />
            <el-option label="C 类" value="C" />
          </el-select>

          <el-button type="primary" @click="fetchList" style="flex-shrink:0">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetFilters" style="flex-shrink:0">
            <el-icon><Refresh /></el-icon> 重置
          </el-button>

          <div class="filter-spacer"></div>

          <el-button @click="$router.push('/instruments/import')" style="flex-shrink:0">
            <el-icon><Upload /></el-icon> 导入Excel
          </el-button>
          <el-dropdown trigger="click" @command="handleExportCommand" style="flex-shrink:0">
            <el-button type="default">
              <el-icon><Download /></el-icon> 导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export-all">📋 导出全部（台帐格式）</el-dropdown-item>
                <el-dropdown-item command="summary-selected" :disabled="selectedRows.length === 0">
                  📊 导出管理一览表（选中 {{ selectedRows.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="summary-all">📊 导出管理一览表（全部）</el-dropdown-item>
                <el-dropdown-item divided command="apply-selected" :disabled="selectedRows.length === 0">
                  📝 导出检定申请表（选中 {{ selectedRows.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="apply-all">📝 导出检定申请表（全部）</el-dropdown-item>
                <el-dropdown-item divided command="workspace-selected" style="color:#409EFF;font-weight:600">
                  🔧 送检工作台{{ selectedRows.length > 0 ? '（选中 ' + selectedRows.length + ' 条）' : '' }}
                </el-dropdown-item>
                <el-dropdown-item divided command="custom-apply" style="color:#e6a23c">
                  ✏️ 自定义导出（自选列）
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="success" plain @click="batchCertVisible = true" style="flex-shrink:0">
            <el-icon><UploadFilled /></el-icon> 批量上传证书
          </el-button>
          <el-button type="warning" plain @click="openCertCheck" style="flex-shrink:0">
            <el-icon><Warning /></el-icon> 证书日期校验
          </el-button>
          <el-button plain @click="openRulesConfig" style="flex-shrink:0">
            <el-icon><Setting /></el-icon> 有效期规则
          </el-button>
          <el-button plain @click="viewLedger" style="flex-shrink:0">
            <el-icon><FolderOpened /></el-icon> 查看台账总表
          </el-button>
          <el-button plain @click="uploadLedgerDialog = true" style="flex-shrink:0">
            <el-icon><Upload /></el-icon> 上传台账总表
          </el-button>
          <el-button plain @click="recycleBinVisible = true" style="flex-shrink:0">
            <el-icon><Delete /></el-icon> 回收站
          </el-button>
          <el-dropdown trigger="click" @command="handleClearCommand" style="flex-shrink:0">
            <el-button type="danger" plain>
              <el-icon><Delete /></el-icon> 清空数据 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="clear-category">
                  <el-icon><FolderDelete /></el-icon> 按类别清空...
                </el-dropdown-item>
                <el-dropdown-item command="clear-all" divided>
                  <el-icon><Warning /></el-icon> 清空全部数据
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 激活的筛选标签 -->
        <div v-if="activeFilterCount > 0" class="active-filters">
          <span class="filter-tags-label">当前筛选：</span>
          <el-tag
            v-if="filters.keyword"
            closable size="small" type="primary"
            @close="filters.keyword = ''; fetchList()"
          >
            关键词：{{ filters.keyword }}
          </el-tag>
          <el-tag
            v-if="filters.category"
            closable size="small" type="success"
            @close="filters.category = ''; fetchList()"
          >
            类别：{{ filters.category }}
          </el-tag>
          <el-tag
            v-if="filters.status"
            closable size="small" :type="filters.status === 'active' ? 'success' : filters.status === 'scrapped' ? 'info' : 'warning'"
            @close="filters.status = ''; fetchList()"
          >
            状态：{{ STATUS_MAP[filters.status] || filters.status }}
          </el-tag>
          <el-tag
            v-if="filters.classification"
            closable size="small" type="info"
            @close="filters.classification = ''; fetchList()"
          >
            分类管理：{{ filters.classification }} 类
          </el-tag>
          <el-tag
            v-if="filters.validDate"
            closable size="small" type="danger"
            @close="filters.validDate = ''; fetchList()"
          >
            有效日期：{{ filters.validDate }}
          </el-tag>
          <el-tag
            v-if="filters.inspectionDate"
            closable size="small" type="warning"
            @close="filters.inspectionDate = ''; fetchList()"
          >
            检验日期：{{ filters.inspectionDate }}
          </el-tag>
          <el-button text size="small" type="primary" @click="resetFilters">
            清除全部筛选
          </el-button>
        </div>
      </div>
    </div>

    <!-- 拍照查找对话框 -->
    <el-dialog v-model="photoSearchVisible" title="📷 拍照查找计量器具" width="500px" :close-on-click-modal="false">
      <div class="photo-search-body">
        <p class="photo-search-hint">拍照或上传铭牌照片，系统自动识别出厂编号并查找对应器具</p>

        <div v-if="photoSearchPreview" class="photo-search-preview">
          <el-image :src="photoUrlWithToken(photoSearchPreview)" fit="contain" style="width:100%;max-height:280px;border-radius:12px" />
        </div>

        <div class="photo-search-actions">
          <input ref="cameraSearchRef" type="file" accept="image/*" capture="environment" style="display:none" @change="handlePhotoSearchFile" />
          <el-button type="primary" size="large" @click="cameraSearchRef?.click()" :loading="photoSearchLoading" style="flex:1">
            <el-icon><Camera /></el-icon> 拍照
          </el-button>

          <input ref="fileSearchRef" type="file" accept="image/*" style="display:none" @change="handlePhotoSearchFile" />
          <el-button size="large" @click="fileSearchRef?.click()" :loading="photoSearchLoading" style="flex:1">
            <el-icon><FolderOpened /></el-icon> 上传图片
          </el-button>
        </div>

        <div v-if="photoSearchResult" class="photo-search-result">
          <el-alert
            :title="photoSearchResult.found ? '已找到匹配器具！' : '未找到匹配器具'"
            :type="photoSearchResult.found ? 'success' : 'warning'"
            :closable="false"
            show-icon
          />
          <div v-if="photoSearchResult.found && photoSearchResult.instrument" class="photo-search-match">
            <div class="match-row"><strong>出厂编号：</strong>{{ photoSearchResult.instrument.serial_number }}</div>
            <div class="match-row"><strong>器具类别：</strong>{{ photoSearchResult.instrument.category }}</div>
            <div class="match-row"><strong>型号：</strong>{{ photoSearchResult.instrument.model || '-' }}</div>
            <div class="match-row"><strong>安装位置：</strong>{{ photoSearchResult.instrument.installation_location || '-' }}</div>
            <el-button type="primary" style="margin-top:12px;width:100%" @click="goToPhotoSearchResult">
              查看详情
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 批量上传证书对话框 -->
    <el-dialog v-model="batchCertVisible" title="📄 批量上传证书" width="700px" :close-on-click-modal="false" @close="resetBatchUpload">
      <div class="batch-cert-body">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
          <template #title>
            支持批量上传PDF证书文件，系统将自动从文件名提取出厂编号并匹配对应器具<br/>
            <small>文件名格式：<code>YB-H1-ZX1-2026040306-2313072607.pdf</code>（最后一段为出厂编号）</small>
          </template>
        </el-alert>

        <!-- 上传区域 -->
        <el-upload
          ref="batchUploadRef"
          v-model:file-list="batchFiles"
          :auto-upload="false"
          :accept="'.pdf'"
          multiple
          drag
          :limit="200"
        >
          <template #default>
            <div class="upload-drag-area">
              <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
              <p>将PDF证书拖拽到此处，或<em>点击选择文件</em></p>
              <p class="upload-hint">支持同时选择多个PDF文件，最多200个</p>
            </div>
          </template>
        </el-upload>

        <!-- 上传中进度 -->
        <div v-if="batchUploading" style="margin-top:16px; text-align:center">
          <el-progress :percentage="batchProgress" :status="batchProgress === 100 ? 'success' : ''" />
          <p style="color:#909399;margin-top:8px">正在处理中...</p>
        </div>

        <!-- 结果展示 -->
        <div v-if="batchResults && batchResults.length > 0" class="batch-results" style="margin-top:16px">
          <el-divider />
          <div class="results-summary" style="margin-bottom:12px">
            <el-tag type="success">匹配成功: {{ batchSummary.matched }}</el-tag>
            <el-tag type="warning" style="margin-left:8px">未匹配: {{ batchSummary.unmatched }}</el-tag>
            <el-tag type="danger" style="margin-left:8px">出错: {{ batchSummary.error }}</el-tag>
          </div>
          <el-table :data="batchResults" max-height="300" size="small" stripe>
            <el-table-column prop="fileName" label="文件名" min-width="280" show-overflow-tooltip />
            <el-table-column prop="serialNumber" label="出厂编号" width="140" show-overflow-tooltip />
            <el-table-column prop="category" label="类别前缀" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="检验日期" width="110" align="center">
              <template #default="{ row }">
                <span v-if="row.extractedInspectionDate">{{ row.extractedInspectionDate }}</span>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="有效日期" width="110" align="center">
              <template #default="{ row }">
                <span v-if="row.calculatedValidUntil">{{ row.calculatedValidUntil }}</span>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="匹配结果" width="160">
              <template #default="{ row }">
                <template v-if="row.status === 'matched'">
                  <el-tag size="small" type="success">✅ {{ row.matchedInstrument?.serial_number }}</el-tag>
                </template>
                <template v-else-if="row.status === 'multi_match'">
                  <div style="display:flex;align-items:center;gap:4px">
                    <el-tag size="small" type="warning">⚠ 多条匹配（{{ row.matchedInstruments?.length }}）</el-tag>
                    <el-button link size="small" type="primary" @click="openMultiMatchDialog(row)">处理</el-button>
                  </div>
                </template>
                <template v-else-if="row.status === 'unmatched'">
                  <div style="display:flex;align-items:center;gap:4px">
                    <el-tag size="small" type="warning">⚠ 未匹配</el-tag>
                    <el-dropdown trigger="click" @command="(cmd) => handleUnmatchedAction(cmd, row)">
                      <el-button link size="small" type="primary">
                        处理 <el-icon><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="search">
                            <el-icon><Search /></el-icon> 模糊搜索匹配
                          </el-dropdown-item>
                          <el-dropdown-item command="manual">
                            <el-icon><List /></el-icon> 手动选择器具
                          </el-dropdown-item>
                          <el-dropdown-item command="create" divided>
                            <el-icon><Plus /></el-icon> 用证书信息新建器具
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </template>
                <template v-else>
                  <el-tag size="small" type="danger">❌ {{ row.error || '解析失败' }}</el-tag>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="batchCertVisible = false">关闭</el-button>
        <el-button
          v-if="batchResults"
          type="danger"
          plain
          :disabled="batchUploading"
          @click="clearBatchResults"
        >
          <el-icon><Delete /></el-icon>
          清除结果，继续上传
        </el-button>
        <el-button
          type="primary"
          :disabled="batchFiles.length === 0"
          :loading="batchUploading"
          @click="handleBatchUpload"
        >
          <el-icon><UploadFilled /></el-icon>
          上传并匹配（{{ batchFiles.length }} 个文件）
        </el-button>
      </template>
    </el-dialog>

    <!-- 未匹配证书 → 模糊搜索匹配对话框 -->
    <el-dialog v-model="fuzzyMatchVisible" title="🔍 查找匹配器具" width="750px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        证书出厂编号：<code>{{ activeUnmatched?.serialNumber }}</code>，
        类别：<el-tag size="small">{{ activeUnmatched?.category || '未知' }}</el-tag>
      </el-alert>
      <el-input v-model="fuzzySearchKeyword" placeholder="输入安装位置、型号等辅助搜索…" clearable
        @input="onFuzzySearchDebounce" style="margin-bottom:12px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-table :data="fuzzyCandidates" @row-dblclick="(c) => confirmFuzzyMatch(c)"
        highlight-current-row max-height="380" size="small" v-loading="fuzzySearching">
        <el-table-column label="操作" width="75" align="center">
          <template #default="{ row: candidate }">
            <el-button size="small" type="primary" @click="confirmFuzzyMatch(candidate)">匹配</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="130" />
        <el-table-column prop="serial_number" label="出厂编号" width="170">
          <template #default="{ row: candidate }">
            <span :style="{ color: candidate.similarity < 1 ? '#e6a23c' : '' }">
              {{ candidate.serial_number }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="installation_location" label="安装位置" min-width="150" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column label="相似度" width="90" align="center">
          <template #default="{ row: candidate }">
            <el-progress :percentage="Math.round(candidate.similarity * 100)"
              :status="candidate.similarity >= 0.9 ? 'success' : ''"
              :stroke-width="8" :show-text="false" />
            <small>{{ Math.round(candidate.similarity * 100) }}%</small>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="fuzzyCandidates.length === 0 && fuzzySearched" style="text-align:center;padding:32px;color:#909399">
        未找到匹配的器具，建议
        <el-button link type="primary" @click="fuzzyMatchVisible = false; createFromCert(activeUnmatched)">
          用证书信息新建器具
        </el-button>
      </div>
      <template #footer>
        <el-button @click="fuzzyMatchVisible = false">取消</el-button>
        <el-button type="success" @click="fuzzyMatchVisible = false; createFromCert(activeUnmatched)">
          用证书信息新建器具
        </el-button>
      </template>
    </el-dialog>

    <!-- 未匹配证书 → 确认以证书为准修正 -->
    <el-dialog v-model="confirmMatchVisible" title="⚠ 确认以证书为准修正" width="500px" :close-on-click-modal="false">
      <div style="line-height:2.2">
        <p>即将将以下器具关联到证书：</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
          <tr><td style="color:#909399;padding:4px 8px">证书出厂编号</td>
            <td style="font-weight:bold;color:#409EFF;padding:4px 8px">{{ activeUnmatched?.serialNumber }}</td></tr>
          <tr><td style="color:#909399;padding:4px 8px">证书编号</td>
            <td style="padding:4px 8px;word-break:break-all">{{ activeUnmatched?.certificateNumber }}</td></tr>
          <tr v-if="activeUnmatched?.extractedInspectionDate" style="background:#f0f9eb">
            <td style="color:#909399;padding:4px 8px">证书检验日期</td>
            <td style="font-weight:bold;color:#67c23a;padding:4px 8px">{{ activeUnmatched?.extractedInspectionDate }}</td></tr>
          <tr v-if="activeUnmatched?.calculatedValidUntil" style="background:#f0f9eb">
            <td style="color:#909399;padding:4px 8px">计算有效日期</td>
            <td style="font-weight:bold;color:#67c23a;padding:4px 8px">{{ activeUnmatched?.calculatedValidUntil }}</td></tr>
          <tr style="background:#fef0f0">
            <td style="color:#909399;padding:4px 8px">系统当前出厂编号</td>
            <td style="font-weight:bold;color:#e6a23c;padding:4px 8px">{{ confirmMatchTarget?.serial_number }}</td></tr>
          <tr><td style="color:#909399;padding:4px 8px">器具类别</td>
            <td style="padding:4px 8px">{{ confirmMatchTarget?.category }}</td></tr>
          <tr><td style="color:#909399;padding:4px 8px">安装位置</td>
            <td style="padding:4px 8px">{{ confirmMatchTarget?.installation_location || '-' }}</td></tr>
          <tr><td style="color:#909399;padding:4px 8px">型号</td>
            <td style="padding:4px 8px">{{ confirmMatchTarget?.model || '-' }}</td></tr>
        </table>
        <el-checkbox v-model="confirmUpdateSerial">
          同时将出厂编号修改为 <code>{{ activeUnmatched?.serialNumber }}</code>（以证书为准）
        </el-checkbox>
        <el-alert type="warning" :closable="false" show-icon style="margin-top:12px">
          此操作将修改台账数据，修改记录会写入变更历史。
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="confirmMatchVisible = false">取消</el-button>
        <el-button type="primary" :loading="forceMatching" @click="executeForceMatch">确认修正</el-button>
      </template>
    </el-dialog>

    <!-- 未匹配证书 → 手动选择器具 -->
    <el-dialog v-model="manualMatchVisible" title="📋 手动选择目标器具" width="820px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px">
        证书出厂编号：<code>{{ activeUnmatched?.serialNumber }}</code>，请选择要关联的器具
      </el-alert>
      <el-input v-model="manualSearchKeyword" placeholder="搜索出厂编号/型号/位置…" clearable
        @input="onManualSearch" style="margin-bottom:12px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-table :data="manualCandidates" highlight-current-row max-height="400" size="small"
        v-loading="manualSearching" @row-click="selectManualTarget">
        <el-table-column label="选择" width="60" align="center">
          <template #default="{ row }">
            <el-radio :model-value="manualTarget?.id" :value="row.id" @change="selectManualTarget(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="130" />
        <el-table-column prop="serial_number" label="出厂编号" width="170" />
        <el-table-column prop="installation_location" label="安装位置" min-width="150" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column prop="manufacturer" label="厂家" width="120" />
      </el-table>
      <template #footer>
        <el-button @click="manualMatchVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!manualTarget" @click="confirmManualMatch">
          确认选择并关联证书
        </el-button>
      </template>
    </el-dialog>

    <!-- 未匹配证书 → 新建器具 -->
    <el-dialog v-model="createFromCertVisible" title="📝 用证书信息新建器具" width="520px" :close-on-click-modal="false">
      <el-form :model="newFromCertForm" label-width="90px" size="default">
        <el-form-item label="器具类别">
          <el-select v-model="newFromCertForm.category" filterable allow-create style="width:100%">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="出厂编号">
          <el-input :model-value="newFromCertForm.serialNumber" disabled />
        </el-form-item>
        <el-form-item label="证书编号">
          <el-input :model-value="newFromCertForm.certificateNumber" disabled />
        </el-form-item>
        <el-form-item label="检验日期">
          <el-input :model-value="newFromCertForm.inspectionDate" disabled />
        </el-form-item>
        <el-form-item label="有效日期">
          <el-input :model-value="newFromCertForm.validUntil" disabled />
        </el-form-item>
        <el-form-item label="分类管理">
          <el-select v-model="newFromCertForm.classification" clearable style="width:100%">
            <el-option label="A 类" value="A类" />
            <el-option label="B 类" value="B类" />
            <el-option label="C 类" value="C类" />
          </el-select>
        </el-form-item>
        <el-form-item label="安装位置">
          <el-input v-model="newFromCertForm.location" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createFromCertVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingFromCert" @click="executeCreateFromCert">
          创建器具并关联证书
        </el-button>
      </template>
    </el-dialog>

    <!-- 多条匹配选择对话框 -->
    <el-dialog v-model="multiMatchVisible" title="⚠ 多条匹配 — 请选择目标器具" width="700px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px">
        证书出厂编号 <code>{{ multiMatchCert?.serialNumber }}</code> 匹配到
        <strong>{{ multiMatchCert?.matchedInstruments?.length || 0 }}</strong> 条器具，请选择要关联的目标（可多选）。
      </el-alert>
      <div class="multi-match-list">
        <div v-for="inst in (multiMatchCert?.matchedInstruments || [])" :key="inst.id"
          :class="['multi-match-item', { selected: multiMatchSelected.has(inst.id), mismatch: inst.categoryMatch === false }]"
          @click="toggleMultiSelect(inst.id)">
          <el-checkbox :model-value="multiMatchSelected.has(inst.id)" @click.stop @change="toggleMultiSelect(inst.id)" />
          <div class="mm-info">
            <div class="mm-line1">
              <el-tag size="small" :type="inst.categoryMatch === false ? 'danger' : ''">#{{ inst.id }}</el-tag>
              <span class="mm-category">{{ inst.category }}</span>
              <code class="mm-serial">{{ inst.serial_number }}</code>
              <el-tag v-if="inst.categoryMatch === false" size="small" type="danger">类别不一致</el-tag>
            </div>
            <div class="mm-line2">
              <span>位置: {{ inst.installation_location || '-' }}</span>
              <span>型号: {{ inst.model || '-' }}</span>
              <span>厂家: {{ inst.manufacturer || '-' }}</span>
            </div>
            <div class="mm-line3">
              <span>证书: {{ (inst.certificate_number || '').slice(-24) || '(空)' }}</span>
              <span>检验日期: {{ inst.inspection_date || '(空)' }}</span>
              <span :style="{ color: getMmDateColor(inst.valid_until) }">有效至: {{ inst.valid_until || '(空)' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:8px">
        <el-button link size="small" @click="multiMatchCert?.matchedInstruments?.forEach(i => multiMatchSelected.add(i.id))">全选</el-button>
        <el-button link size="small" @click="multiMatchSelected.clear()">清空</el-button>
        <span style="font-size:12px;color:#909399;margin-left:8px">已选 {{ multiMatchSelected.size }} 条</span>
      </div>
      <template #footer>
        <el-button @click="multiMatchVisible = false">全部跳过</el-button>
        <el-button type="primary" :disabled="multiMatchSelected.size === 0" :loading="multiMatching" @click="executeMultiMatch">
          确认所选（{{ multiMatchSelected.size }} 条）
        </el-button>
      </template>
    </el-dialog>

    <!-- 证书日期校验对话框 -->
    <el-dialog v-model="certCheckVisible" title="📋 证书日期校验" width="1100px" :close-on-click-modal="false" @open="loadCertCheck">
      <div v-loading="certCheckLoading">
        <!-- 统计摘要：维度一 -->
        <div v-if="certCheckData" style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-secondary);line-height:24px">证书→检验：</span>
          <el-tag size="small" type="success">匹配 {{ certCheckData.certMatch }}</el-tag>
          <el-tag size="small" type="danger">不匹配 {{ certCheckData.certMismatch }}</el-tag>
          <el-tag size="small" type="danger">缺失 {{ certCheckData.certMissing }}</el-tag>
          <el-tag size="small" type="info">无法提取 {{ certCheckData.certNoExtract }}</el-tag>
        </div>
        <!-- 统计摘要：维度二 -->
        <div v-if="certCheckData" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-secondary);line-height:24px">检验→有效：</span>
          <el-tag size="small" type="success">匹配 {{ certCheckData.validMatch }}</el-tag>
          <el-tag size="small" type="danger">不匹配 {{ certCheckData.validMismatch }}</el-tag>
          <el-tag size="small" type="danger">缺失 {{ certCheckData.validMissing }}</el-tag>
        </div>

        <div v-if="certCheckData" style="margin-bottom:12px;display:flex;gap:8px">
          <el-checkbox v-model="certCheckOnlyMismatch" @change="loadCertCheck">仅看不匹配/缺失</el-checkbox>
          <el-button type="primary" size="small" :disabled="certCheckSelected.length === 0" @click="handleBatchUpdateDates">
            批量更新选中项（{{ certCheckSelected.length }}）
          </el-button>
        </div>

        <el-table
          v-if="certCheckData"
          :data="certCheckData.results"
          max-height="400"
          size="small"
          stripe
          @selection-change="(rows) => certCheckSelected = rows"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column prop="category" label="类别" width="90" show-overflow-tooltip />
          <el-table-column prop="serial_number" label="出厂编号" width="120" show-overflow-tooltip />
          <el-table-column prop="certificate_number" label="证书编号" min-width="200" show-overflow-tooltip />
          <el-table-column label="证书→检验" width="150" align="center">
            <template #default="{ row }">
              <template v-if="row.cert_status === 'cert_mismatch'">
                <span style="text-decoration:line-through;color:#dc2626;font-size:12px">{{ formatDate(row.inspection_date) }}</span>
                <span style="color:#16a34a;font-weight:600;margin-left:2px">→ {{ row.extracted_date }}</span>
              </template>
              <template v-else-if="row.cert_status === 'cert_missing'">
                <span style="color:#c0c4cc">-</span>
                <span style="color:#16a34a;font-weight:600;margin-left:2px">→ {{ row.extracted_date }}</span>
              </template>
              <span v-else-if="row.cert_status === 'cert_match'" style="color:#16a34a;font-size:12px">{{ formatDate(row.inspection_date) }} ✓</span>
              <span v-else style="color:#c0c4cc;font-size:12px">-</span>
            </template>
          </el-table-column>
          <el-table-column label="检验→有效" width="160" align="center">
            <template #default="{ row }">
              <template v-if="row.valid_status === 'valid_mismatch'">
                <span style="text-decoration:line-through;color:#dc2626;font-size:12px">{{ formatDate(row.valid_until) }}</span>
                <span style="color:#409EFF;font-weight:600;margin-left:2px">→ {{ row.expected_valid_until }}</span>
              </template>
              <template v-else-if="row.valid_status === 'valid_missing'">
                <span style="color:#c0c4cc">-</span>
                <span style="color:#409EFF;font-weight:600;margin-left:2px">→ {{ row.expected_valid_until }}</span>
              </template>
              <span v-else-if="row.valid_status === 'valid_match'" style="color:#16a34a;font-size:12px">{{ formatDate(row.valid_until) }} ✓</span>
              <span v-else style="color:#c0c4cc;font-size:12px">-</span>
            </template>
          </el-table-column>
          <el-table-column label="综合" width="70" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'match'" size="small" type="success">正常</el-tag>
              <el-tag v-else-if="row.status === 'mismatch'" size="small" type="danger">异常</el-tag>
              <el-tag v-else-if="row.status === 'missing'" size="small" type="warning">缺失</el-tag>
              <el-tag v-else size="small" type="info">跳过</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="certCheckData && certCheckData.results.length === 0" description="没有需要关注的记录" />
      </div>

      <template #footer>
        <el-button @click="certCheckVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 有效日期规则配置对话框 -->
    <el-dialog v-model="rulesConfigVisible" title="⚙ 有效日期计算规则" width="750px" :close-on-click-modal="false" @open="loadRules">
      <div v-loading="rulesLoading">
        <div style="margin-bottom:12px;display:flex;gap:8px">
          <el-button size="small" type="danger" plain @click="handleResetRules">重置为默认规则</el-button>
          <el-button size="small" type="primary" @click="openRuleForm(null)">+ 新增规则</el-button>
        </div>

        <el-table :data="rulesList" max-height="400" size="small" stripe>
          <el-table-column prop="priority" label="优先级" width="70" align="center" />
          <el-table-column prop="category" label="类别" width="140">
            <template #default="{ row }">
              <el-tag v-if="row.category === '*'" size="small" type="info">* (默认)</el-tag>
              <span v-else>{{ row.category }}</span>
            </template>
          </el-table-column>
          <el-table-column label="分类" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.classification" size="small">{{ row.classification }}类</el-tag>
              <span v-else style="color:#909399">全部</span>
            </template>
          </el-table-column>
          <el-table-column label="有效期" width="100" align="center">
            <template #default="{ row }">
              {{ row.period_value }} {{ row.period_unit === 'year' ? '年' : '月' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openRuleForm(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteRule(row)" :disabled="row.category === '*' && row.classification === null">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top:8px;font-size:12px;color:#909399">
          匹配规则：优先级从高到低，首个匹配类别+分类的规则生效。* = 匹配所有类别，分类为空 = 匹配所有分类。
        </div>
      </div>

      <template #footer>
        <el-button @click="rulesConfigVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑规则弹窗 -->
    <el-dialog v-model="ruleFormVisible" :title="editingRule ? '编辑规则' : '新增规则'" width="420px" :close-on-click-modal="false">
      <el-form :model="ruleForm" label-width="80px" size="default">
        <el-form-item label="器具类别">
          <el-select v-model="ruleForm.category" filterable allow-create placeholder="选择或输入类别" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            <el-option label="* (匹配所有，兜底)" value="*" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类管理">
          <el-select v-model="ruleForm.classification" placeholder="全部（匹配所有分类）" clearable style="width:100%">
            <el-option label="A 类" value="A" />
            <el-option label="B 类" value="B" />
            <el-option label="C 类" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期">
          <el-input-number v-model="ruleForm.period_value" :min="1" :max="99" style="width:120px" />
          <el-select v-model="ruleForm.period_unit" style="width:90px;margin-left:8px">
            <el-option label="月" value="month" />
            <el-option label="年" value="year" />
          </el-select>
          <span style="margin-left:8px;font-size:12px;color:#909399">（−1天）</span>
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="ruleForm.priority" :min="0" :max="99" style="width:120px" />
          <span style="margin-left:8px;font-size:12px;color:#909399">越大越优先</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleFormVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <!-- 数据表格 -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">
          <span>📋 计量器具台账</span>
          <el-tag type="info" size="small" effect="plain" round>共 {{ pagination.total }} 条</el-tag>
        </div>
        <div class="table-actions">
          <el-tooltip content="左右滑动查看更多列" placement="top">
            <span class="scroll-hint">
              <el-icon><DArrowRight /></el-icon> 横向滚动查看更多
            </span>
          </el-tooltip>
          <el-dropdown trigger="click" @command="handleSelectAllCommand" style="flex-shrink:0">
            <el-button size="small" plain>
              <el-icon><Select /></el-icon> 全选 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="select-page">
                  📄 全选当前页（{{ tableData.length }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="select-all">
                  📋 全选所有筛选结果（{{ pagination.total }} 条）
                </el-dropdown-item>
                <el-dropdown-item command="clear-selection" divided>
                  ✖ 清除选中
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-if="selectAllMode" class="select-all-badge">
            🟢 已全选 {{ pagination.total }} 条
          </span>
          <el-button
            :type="denseMode ? 'primary' : 'default'"
            size="small"
            plain
            @click="denseMode = !denseMode"
          >
            {{ denseMode ? '紧凑' : '默认' }}模式
          </el-button>
        </div>
      </div>

      <div class="table-scroll-wrapper">
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        :size="denseMode ? 'small' : 'default'"
        style="width: 100%"
        max-height="calc(100vh - 340px)"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
        ref="tableRef"
        class="modern-table"
      >
        <el-table-column type="selection" width="45" fixed="left" />
        <el-table-column type="index" label="序号" width="60" align="center" fixed="left" :index="indexMethod" />

        <el-table-column prop="category" label="器具类别" width="130" fixed="left" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="category-tag" :style="categoryStyle(row.category)">
              {{ row.category || '-' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="installation_location" label="安装位置" width="150" fixed="left" show-overflow-tooltip />

        <el-table-column prop="serial_number" label="出厂编号" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="serial-number">{{ row.serial_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="certificate_number" label="证书编号" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cert-number">{{ row.certificate_number || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="变更信息" width="230" align="center">
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

        <el-table-column prop="inspection_date" width="120" align="center">
          <template #header>
            <div class="date-col-header">
              <span>检验日期</span>
              <el-popover
                v-model:visible="inspectionDateFilterVisible"
                placement="bottom"
                :width="260"
                trigger="manual"
                :hide-after="0"
                @show="inspectionDateFilterTemp = filters.inspectionDate || ''"
              >
                <template #reference>
                  <el-icon
                    class="date-filter-icon"
                    :class="{ 'filter-active': !!filters.inspectionDate }"
                    :size="14"
                    @click.stop="inspectionDateFilterVisible = !inspectionDateFilterVisible"
                  ><Filter /></el-icon>
                </template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker
                    v-model="inspectionDateFilterTemp"
                    type="date"
                    placeholder="选择检验日期"
                    value-format="YYYY-MM-DD"
                    size="small"
                    style="width:100%"
                    :teleported="false"
                  />
                  <div class="date-filter-actions">
                    <el-button size="small" @click="inspectionDateFilterTemp = ''; inspectionDateFilterVisible = false; filters.inspectionDate = ''; fetchList()">清除</el-button>
                    <el-button size="small" type="primary" @click="applyInspectionDateFilter">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
          <template #default="{ row }">{{ formatDate(row.inspection_date) }}</template>
        </el-table-column>

        <el-table-column prop="valid_until" width="130" sortable="custom" align="center">
          <template #header>
            <div class="date-col-header">
              <span>有效日期</span>
              <el-popover
                v-model:visible="validDateFilterVisible"
                placement="bottom"
                :width="260"
                trigger="manual"
                :hide-after="0"
                @show="validDateFilterTemp = filters.validDate || ''"
              >
                <template #reference>
                  <el-icon
                    class="date-filter-icon"
                    :class="{ 'filter-active': !!filters.validDate }"
                    :size="14"
                    @click.stop="validDateFilterVisible = !validDateFilterVisible"
                  ><Filter /></el-icon>
                </template>
                <div class="date-filter-popover" @click.stop>
                  <el-date-picker
                    v-model="validDateFilterTemp"
                    type="date"
                    placeholder="选择有效日期"
                    value-format="YYYY-MM-DD"
                    size="small"
                    style="width:100%"
                    :teleported="false"
                  />
                  <div class="date-filter-actions">
                    <el-button size="small" @click="validDateFilterTemp = ''; validDateFilterVisible = false; filters.validDate = ''; fetchList()">清除</el-button>
                    <el-button size="small" type="primary" @click="applyValidDateFilter">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
          <template #default="{ row }">
            <el-tag :type="getValidTagType(row.valid_until)" size="small" effect="dark" class="valid-tag">
              {{ formatDate(row.valid_until) || '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="分类管理" width="85" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="getClassification(row)" :class="'classification-badge classification-' + getClassificationLevel(row)">
              {{ getClassification(row) }}
            </span>
            <span v-else class="classification-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="model" label="型号规格" width="120" show-overflow-tooltip />

        <el-table-column prop="manufacturer" label="生产厂家" width="150" show-overflow-tooltip />

        <el-table-column label="量程" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatRange(row) }}</template>
        </el-table-column>

        <el-table-column prop="accuracy_class" label="准确度" width="85" align="center" show-overflow-tooltip />

        <el-table-column prop="inspection_unit" label="检定单位" width="160" show-overflow-tooltip />

        <el-table-column prop="status" label="状态" width="75" align="center">
          <template #default="{ row }">
            <span class="status-dot-badge" :class="'status-' + row.status">
              {{ STATUS_MAP[row.status] || row.status }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="photo_url" label="照片" width="70" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.photo_url"
              :src="photoUrlWithToken(row.photo_url)"
              :preview-src-list="[photoUrlWithToken(row.photo_url)]"
              fit="cover"
              style="width: 40px; height: 40px; border-radius: 8px;"
              lazy
            >
              <template #error>
                <el-icon :size="22"><PictureFilled /></el-icon>
              </template>
            </el-image>
            <div v-else class="no-photo">
              <el-icon :size="20"><PictureFilled /></el-icon>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="附件" width="85" align="center">
          <template #default="{ row }">
            <template v-if="row.certificate_file">
              <el-button link type="primary" size="small" @click="viewCertificate(row)">
                <el-icon :size="16"><Document /></el-icon>
              </el-button>
            </template>
            <input
              type="file"
              accept=".pdf"
              :ref="el => certInputRefs[row.id] = el"
              style="display:none"
              @change="(e) => handleSingleCertUpload(row, e)"
            />
            <el-button link size="small" :type="row.certificate_file ? 'default' : 'primary'" @click="certInputRefs[row.id]?.click()">
              <el-icon :size="14"><FolderAdd /></el-icon>
            </el-button>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="$router.push('/instruments/' + row.id)">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-divider direction="vertical" />
            <el-popconfirm
              title="确定删除该记录？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" link size="small">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      </div><!-- end table-scroll-wrapper -->

      <div class="table-footer">
        <div class="table-info">
          第 {{ pagination.page }} 页 / 共 {{ Math.ceil(pagination.total / pagination.pageSize) }} 页，显示第 {{ (pagination.page - 1) * pagination.pageSize + 1 }} - {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 条
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 30, 50, 100, 200, 400]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <!-- 按类别清空对话框 -->
    <el-dialog v-model="clearCategoryVisible" title="按类别清空数据" width="420px" :close-on-click-modal="false">
      <el-alert
        title="此操作将删除指定类别下的所有计量器具记录，不可撤销！"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom:16px"
      />
      <el-form label-width="80px">
        <el-form-item label="选择类别">
          <el-select v-model="clearCategory" placeholder="请选择要清空的类别" filterable style="width:100%">
            <el-option
              v-for="cat in categories"
              :key="cat"
              :label="cat + ' (' + categoryDataCount(cat) + '条)'"
              :value="cat"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clearCategoryVisible = false">取消</el-button>
        <el-button type="danger" :disabled="!clearCategory" :loading="clearCategoryLoading" @click="handleClearByCategory">
          确认清空
        </el-button>
      </template>
    </el-dialog>

    <InstrumentHistoryDrawer v-model="historyVisible" :instrument="historyInstrument" @restored="fetchList" />
    <InstrumentRecycleBin v-model="recycleBinVisible" @restored="fetchList" />

    <!-- 上传台账总表对话框 -->
    <el-dialog v-model="uploadLedgerDialog" title="📥 上传台账总表" width="460px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        上传后将覆盖已有台账总表。上传后可在"查看台账总表"中随时打开。
      </el-alert>
      <el-upload
        ref="ledgerUploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleLedgerFileChange"
        :on-remove="handleLedgerFileRemove"
        drag
      >
        <div class="upload-drag-area">
          <el-icon :size="36" color="#409EFF"><UploadFilled /></el-icon>
          <p>拖拽Excel到此处，或<em>点击选择文件</em></p>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="uploadLedgerDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!ledgerFile" :loading="uploadingLedger" @click="handleUploadLedger">
          确认上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 导出列选择对话框 -->
    <el-dialog v-model="exportColumnsVisible" title="📋 选择导出列" width="480px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        勾选需要导出的字段，未勾选的字段将不会出现在导出文件中。
      </el-alert>
      <div class="export-columns-grid">
        <el-checkbox v-for="opt in EXPORT_FIELD_OPTIONS" :key="opt.value"
          :model-value="exportSelectedColumns.includes(opt.value)"
          @change="(val) => toggleExportColumn(opt.value, val)">
          {{ opt.label }}
        </el-checkbox>
      </div>
      <div style="margin-top:12px">
        <el-button link size="small" @click="exportSelectedColumns = EXPORT_FIELD_OPTIONS.map(o => o.value)">全选</el-button>
        <el-button link size="small" @click="exportSelectedColumns = []">清空</el-button>
        <span style="margin-left:8px;font-size:12px;color:#909399">已选 {{ exportSelectedColumns.length }} / {{ EXPORT_FIELD_OPTIONS.length }} 列</span>
      </div>
      <template #footer>
        <el-button @click="exportColumnsVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmExportWithColumns">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Search, Plus, Upload, Download, Refresh, Edit, Delete, PictureFilled, DArrowRight, Camera, FolderOpened, ArrowDown, UploadFilled, FolderDelete, Warning, Filter, Select, Document, Setting, FolderAdd, List
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstruments, deleteInstrument, exportInstruments, exportManagementSummary, exportWarningApply, batchUploadCertificates, getCategories, clearAllInstruments, clearByCategory, uploadPhoto, ocrFromUrl, getInstrumentStats, checkCertDates, batchUpdateCertDates, getValidityRules, createValidityRule, updateValidityRule, deleteValidityRule, resetValidityRules, uploadCertificateForInstrument, searchUnmatchedCert, forceMatchCert, createInstrumentFromCert, getLedgerInfo, uploadLedger, confirmCertMatch } from '../api/instruments'
import { STATUS_OPTIONS, STATUS_MAP, CATEGORIES, getCategoryColor, FIELD_OPTIONS } from '../utils/constants'
import { useAuthStore } from '../stores/auth'
import InstrumentHistoryDrawer from '../components/InstrumentHistoryDrawer.vue'
import InstrumentRecycleBin from '../components/InstrumentRecycleBin.vue'

const route = useRoute()
const authStore = useAuthStore()
function photoUrlWithToken(url) {
  // blob URL 不需要鉴权 token（浏览器本地资源）
  if (!url || !authStore.token || url.startsWith('blob:')) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'token=' + authStore.token
}
const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const categories = ref(CATEGORIES)
const denseMode = ref(false)
const selectedRows = ref([])
const selectAllMode = ref(false)
const tableRef = ref(null)
const historyVisible = ref(false)
const historyInstrument = ref(null)
const recycleBinVisible = ref(false)
const uploadLedgerDialog = ref(false)
const ledgerFile = ref(null)
const uploadingLedger = ref(false)
const ledgerUploadRef = ref(null)

// === 批量上传证书 ===
const batchCertVisible = ref(false)
const batchFiles = ref([])
const batchUploading = ref(false)
const batchProgress = ref(0)
const batchResults = ref(null)
const batchSummary = ref({ matched: 0, unmatched: 0, error: 0 })

// === 单证书上传 ===
const certInputRefs = ref({})

// === 未匹配证书处理 ===
const fuzzyMatchVisible = ref(false)
const confirmMatchVisible = ref(false)
const manualMatchVisible = ref(false)
const createFromCertVisible = ref(false)
const multiMatchVisible = ref(false)
const multiMatchCert = ref(null)
const multiMatchSelected = reactive(new Set())
const multiMatching = ref(false)
const activeUnmatched = ref(null)
const confirmMatchTarget = ref(null)
const confirmUpdateSerial = ref(false)
const fuzzySearchKeyword = ref('')
const fuzzyCandidates = ref([])
const fuzzySearching = ref(false)
const fuzzySearched = ref(false)
let fuzzySearchTimer = null
const forceMatching = ref(false)
const manualSearchKeyword = ref('')
const manualCandidates = ref([])
const manualTarget = ref(null)
const manualSearching = ref(false)
const newFromCertForm = ref({ category: '', serialNumber: '', certificateNumber: '', inspectionDate: '', validUntil: '', classification: '', location: '' })
const creatingFromCert = ref(false)

// === 证书日期校验 ===
const certCheckVisible = ref(false)
const certCheckLoading = ref(false)
const certCheckData = ref(null)
const certCheckOnlyMismatch = ref(true)
const certCheckSelected = ref([])

// === 有效日期规则配置 ===
const rulesConfigVisible = ref(false)
const rulesLoading = ref(false)
const rulesList = ref([])
const ruleFormVisible = ref(false)
const editingRule = ref(null)
const ruleForm = reactive({
  category: '', classification: null, period_value: 1, period_unit: 'year', priority: 0
})

// === 拍照查找 ===
const photoSearchVisible = ref(false)
const photoSearchLoading = ref(false)
const photoSearchPreview = ref('')
const photoSearchResult = ref(null)
const cameraSearchRef = ref(null)
const fileSearchRef = ref(null)

let searchTimer = null

// 日期列筛选弹窗
const inspectionDateFilterVisible = ref(false)
const validDateFilterVisible = ref(false)
const inspectionDateFilterTemp = ref('')
const validDateFilterTemp = ref('')

const filters = reactive({
  keyword: '',
  category: '',
  status: '',
  classification: '',
  validDate: '',
  inspectionDate: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  sortBy: 'updated_at',
  sortOrder: 'desc'
})

function formatNumber(val) {
  if (val === null || val === undefined) return ''
  return String(Number(val))
}

function formatRange(row) {
  const parts = []
  if (row.range_min !== null && row.range_min !== undefined) parts.push(formatNumber(row.range_min))
  if (row.range_max !== null && row.range_max !== undefined) {
    parts.push(parts.length ? ' ~ ' + formatNumber(row.range_max) : formatNumber(row.range_max))
  }
  if (row.range_unit) parts.push(' ' + row.range_unit)
  return parts.length > 0 ? parts.join('') : '-'
}

function formatDate(date) {
  if (!date) return ''
  return String(date).slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  })
}

function openHistory(row) {
  historyInstrument.value = row
  historyVisible.value = true
}

function getValidTagType(validUntil) {
  if (!validUntil) return 'info'
  const diff = Math.ceil((new Date(validUntil) - new Date()) / 86400000)
  if (diff < 0) return 'danger'
  if (diff <= 30) return 'warning'
  return 'success'
}

function onSearchDebounce() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchList, 300)
}

const activeFilterCount = computed(() => {
  let count = 0
  if (filters.keyword) count++
  if (filters.category) count++
  if (filters.status) count++
  if (filters.classification) count++
  if (filters.validDate) count++
  if (filters.inspectionDate) count++
  return count
})

function resetFilters() {
  filters.keyword = ''
  filters.category = ''
  filters.status = ''
  filters.classification = ''
  filters.validDate = ''
  filters.inspectionDate = ''
  validDateFilterTemp.value = ''
  inspectionDateFilterTemp.value = ''
  pagination.page = 1
  fetchList()
}

function applyInspectionDateFilter() {
  filters.inspectionDate = inspectionDateFilterTemp.value || ''
  inspectionDateFilterVisible.value = false
  fetchList()
}

function applyValidDateFilter() {
  filters.validDate = validDateFilterTemp.value || ''
  validDateFilterVisible.value = false
  fetchList()
}

async function fetchList() {
  loading.value = true
  // 数据重新加载时清除全选模式（筛选条件变化或翻页时自动退出）
  selectAllMode.value = false
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.classification) params.classification = filters.classification
    if (filters.validDate) {
      params.validFrom = filters.validDate
      params.validTo = filters.validDate
    }
    if (filters.inspectionDate) {
      params.inspectionFrom = filters.inspectionDate
      params.inspectionTo = filters.inspectionDate
    }

    // 同步筛选状态到URL参数
    const query = {}
    if (filters.keyword) query.keyword = filters.keyword
    if (filters.category) query.category = filters.category
    if (filters.status) query.status = filters.status
    if (filters.classification) query.classification = filters.classification
    if (filters.validDate) {
      query.validDate = filters.validDate
    }
    if (filters.inspectionDate) {
      query.inspectionDate = filters.inspectionDate
    }
    router.replace({ path: '/instruments', query })

    const res = await getInstruments(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
    if (tableData.value.length === 0 && pagination.page > 1 && pagination.total > 0) {
      pagination.page--
      return fetchList()
    }
    await nextTick()
    tableRef.value?.doLayout()
  } catch (err) {
    // handled
  } finally {
    loading.value = false
  }
}

function handleSortChange({ prop, order }) {
  if (prop) {
    pagination.sortBy = prop === 'valid_until' ? 'valid_until' : prop
  }
  pagination.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  fetchList()
}

function indexMethod(idx) {
  return (pagination.page - 1) * pagination.pageSize + idx + 1
}

async function handleDelete(id) {
  try {
    await deleteInstrument(id)
    ElMessage.success('删除成功')
    fetchList()
  } catch (err) {
    // handled
  }
}

async function handleClearAll() {
  try {
    const res = await clearAllInstruments()
    ElMessage.success(res.message || '已清空全部数据')
    fetchList()
  } catch (err) {
    // handled
  }
}

// ========== 按类别清空 ==========
const clearCategoryVisible = ref(false)
const clearCategory = ref('')
const clearCategoryLoading = ref(false)

// === 导出列选择 ===
const EXPORT_FIELD_OPTIONS = FIELD_OPTIONS.filter(o => !['range', 'classification', 'pressure_gauge_type'].includes(o.value))
const exportColumnsVisible = ref(false)
const exportSelectedColumns = ref(EXPORT_FIELD_OPTIONS.map(o => o.value))
const pendingExportCommand = ref(null)

function toggleExportColumn(value, checked) {
  if (checked) {
    if (!exportSelectedColumns.value.includes(value)) exportSelectedColumns.value.push(value)
  } else {
    exportSelectedColumns.value = exportSelectedColumns.value.filter(v => v !== value)
  }
}

function openExportColumnPicker(command) {
  pendingExportCommand.value = command
  exportColumnsVisible.value = true
}

function confirmExportWithColumns() {
  exportColumnsVisible.value = false
  if (exportSelectedColumns.value.length === 0) {
    ElMessage.warning('请至少选择一列')
    return
  }
  handleExportCommand(pendingExportCommand.value, exportSelectedColumns.value.join(','))
}

// 类别数据计数（从stats API获取全部数据计数，而非当前页）
const categoryCounts = ref({})

async function loadCategoryCounts() {
  try {
    const res = await getInstrumentStats()
    if (res.data && res.data.byCategory) {
      const counts = {}
      for (const item of res.data.byCategory) {
        counts[item.category] = item.count
      }
      categoryCounts.value = counts
    }
  } catch (e) {
    categoryCounts.value = {}
  }
}

function categoryDataCount(cat) {
  return categoryCounts.value[cat] || 0
}

async function handleClearByCategory() {
  if (!clearCategory.value) {
    ElMessage.warning('请选择要清空的类别')
    return
  }
  clearCategoryLoading.value = true
  try {
    const res = await clearByCategory(clearCategory.value)
    ElMessage.success(res.message || `已清空类别"${clearCategory.value}"的数据`)
    clearCategoryVisible.value = false
    clearCategory.value = ''
    fetchList()
  } catch (err) {
    // handled by interceptor
  } finally {
    clearCategoryLoading.value = false
  }
}

function handleClearCommand(cmd) {
  if (cmd === 'clear-category') {
    clearCategoryVisible.value = true
    loadCategoryCounts()
  } else if (cmd === 'clear-all') {
    ElMessageBox.confirm(
      '确定要清空所有计量器具数据吗？此操作不可撤销！',
      '清空全部数据',
      { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'error' }
    ).then(() => {
      handleClearAll()
    }).catch(() => {})
  }
}

async function handleExport() {
  try {
    const params = {}
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.category) params.category = filters.category
    if (filters.status) params.status = filters.status
    if (filters.validDate) {
      params.validFrom = filters.validDate
      params.validTo = filters.validDate
    }
    if (filters.inspectionDate) {
      params.inspectionFrom = filters.inspectionDate
      params.inspectionTo = filters.inspectionDate
    }
    params.sortBy = pagination.sortBy
    params.sortOrder = pagination.sortOrder

    const res = await exportInstruments(params)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = '计量器具台账_' + new Date().toISOString().slice(0, 10) + '.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    // handled
  }
}

function parseExtraFields(row) {
  if (!row.extra_fields) return {}
  try {
    return typeof row.extra_fields === 'string' ? JSON.parse(row.extra_fields) : row.extra_fields
  } catch (e) { return {} }
}

function getClassification(row) {
  const extra = parseExtraFields(row)
  return extra.classification || extra.分类管理 || extra.分类 || ''
}

function getClassificationLevel(row) {
  const cls = getClassification(row)
  if (cls.includes('A') || cls.includes('a')) return 'a'
  if (cls.includes('B') || cls.includes('b')) return 'b'
  if (cls.includes('C') || cls.includes('c')) return 'c'
  return ''
}

function categoryStyle(category) {
  const c = getCategoryColor(category)
  return {
    backgroundColor: c.bg,
    color: c.text,
    borderColor: c.text + '30'
  }
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
  // 当用户手动取消勾选时，退出全选模式
  if (selectAllMode.value && rows.length < tableData.value.length) {
    selectAllMode.value = false
  }
}

function handleSelectAllCommand(command) {
  if (command === 'select-page') {
    selectAllMode.value = false
    tableRef.value?.toggleAllSelection()
    ElMessage.success(`已全选当前页 ${tableData.value.length} 条记录`)
  } else if (command === 'select-all') {
    selectAllMode.value = true
    // 先清空当前页勾选，进入全选模式
    tableRef.value?.clearSelection()
    ElMessage.success(`已全选所有筛选结果 ${pagination.total} 条记录`)
  } else if (command === 'clear-selection') {
    selectAllMode.value = false
    tableRef.value?.clearSelection()
    ElMessage.info('已清除选中')
  }
}

async function handleExportCommand(command, columns) {
  try {
    const params = {}
    let filename = ''

    if (command === 'custom-apply') {
      openExportColumnPicker('apply-all')
      return
    }

    if (command === 'export-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      params.sortBy = pagination.sortBy
      params.sortOrder = pagination.sortOrder
      const res = await exportInstruments(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = '计量器具台账_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('导出成功')
      return
    }

    // 管理一览表导出
    if (command === 'summary-selected') {
      // 全选模式：使用筛选参数，导出全部匹配结果
      if (selectAllMode.value) {
        if (filters.keyword) params.keyword = filters.keyword
        if (filters.category) params.category = filters.category
        if (filters.status) params.status = filters.status
        if (filters.validDate) {
          params.validFrom = filters.validDate
          params.validTo = filters.validDate
        }
        if (filters.inspectionDate) {
          params.inspectionFrom = filters.inspectionDate
          params.inspectionTo = filters.inspectionDate
        }
        filename = '计量器具管理一览表（全选' + pagination.total + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
        ElMessage.info(`正在导出全部 ${pagination.total} 条记录...`)
        const res = await exportManagementSummary(params)
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.URL.revokeObjectURL(url)
        ElMessage.success('管理一览表导出成功')
        return
      }
      if (selectedRows.value.length === 0) {
        ElMessage.warning('请先选择要导出的计量器具')
        return
      }
      const ids = selectedRows.value.map(r => r.id).join(',')
      params.ids = ids
      filename = '计量器具管理一览表（选中' + selectedRows.value.length + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      ElMessage.info(`正在导出 ${selectedRows.value.length} 条记录...`)
      const res = await exportManagementSummary(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('管理一览表导出成功')
      return
    }

    if (command === 'summary-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      filename = '计量器具管理一览表_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      const res = await exportManagementSummary(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('管理一览表导出成功')
      return
    }

    // 检定申请表导出
    if (command === 'apply-selected') {
      // 全选模式：使用筛选参数，导出全部匹配结果
      if (selectAllMode.value) {
        if (filters.keyword) params.keyword = filters.keyword
        if (filters.category) params.category = filters.category
        if (filters.status) params.status = filters.status
        if (filters.validDate) {
          params.validFrom = filters.validDate
          params.validTo = filters.validDate
        }
        if (filters.inspectionDate) {
          params.inspectionFrom = filters.inspectionDate
          params.inspectionTo = filters.inspectionDate
        }
        filename = '计量器具检定申请表（全选' + pagination.total + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
        ElMessage.info(`正在导出全部 ${pagination.total} 条记录...`)
        if (columns) params.columns = columns
        const res = await exportWarningApply(params)
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.URL.revokeObjectURL(url)
        ElMessage.success('检定申请表导出成功')
        return
      }
      if (selectedRows.value.length === 0) {
        ElMessage.warning('请先选择要导出的计量器具')
        return
      }
      const ids = selectedRows.value.map(r => r.id).join(',')
      params.ids = ids
      if (columns) params.columns = columns
      filename = '计量器具检定申请表（选中' + selectedRows.value.length + '条）_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      ElMessage.info(`正在导出 ${selectedRows.value.length} 条记录...`)
      const res = await exportWarningApply(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('检定申请表导出成功')
      return
    }

    if (command === 'apply-all') {
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.status) params.status = filters.status
      if (filters.classification) params.classification = filters.classification
      if (filters.validDate) {
        params.validFrom = filters.validDate
        params.validTo = filters.validDate
      }
      if (filters.inspectionDate) {
        params.inspectionFrom = filters.inspectionDate
        params.inspectionTo = filters.inspectionDate
      }
      if (columns) params.columns = columns
      filename = '计量器具检定申请表_' + new Date().toISOString().slice(0, 10) + '.xlsx'
      const res = await exportWarningApply(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success('检定申请表导出成功')
      return
    }

    if (command === 'workspace-selected') {
      if (selectedRows.value.length > 0) {
        const ids = selectedRows.value.map(r => r.id).join(',')
        router.push({ path: '/inspection-workspace', query: { ids } })
      } else {
        router.push({ path: '/inspection-workspace' })
      }
      return
    }
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

// === 批量上传证书 ===
function resetBatchUpload() {
  batchFiles.value = []
  batchResults.value = null
  batchSummary.value = { matched: 0, unmatched: 0, error: 0 }
  batchProgress.value = 0
}

async function handleBatchUpload() {
  if (batchFiles.value.length === 0) {
    ElMessage.warning('请先选择PDF文件')
    return
  }

  // 如果已有匹配结果，让用户选择覆盖还是追加
  let appendMode = false
  if (batchResults.value) {
    try {
      await ElMessageBox.confirm(
        '检测到已有匹配结果。是否将新上传的结果追加到现有结果之后？<br/>点击「追加」保留旧结果并添加新结果，点击「覆盖」将清除旧结果并仅显示新结果。',
        '已有匹配结果',
        {
          confirmButtonText: '追加',
          cancelButtonText: '覆盖',
          type: 'warning',
          distinguishCancelAndClose: true,
          dangerouslyUseHTMLString: true
        }
      )
      appendMode = true
    } catch (action) {
      if (action === 'cancel') {
        // 用户选择覆盖：清除旧结果
        clearBatchResults()
      } else {
        // 用户点了右上角X关闭弹窗，取消本次上传
        return
      }
    }
  }

  batchUploading.value = true
  batchProgress.value = 30

  try {
    const rawFiles = batchFiles.value.map(f => f.raw || f)
    const res = await batchUploadCertificates(rawFiles)

    batchProgress.value = 100

    if (appendMode && batchResults.value) {
      // 追加模式：合并新结果到已有结果
      batchResults.value = [...batchResults.value, ...res.data.results]
      batchSummary.value = {
        matched: batchSummary.value.matched + res.data.matched,
        unmatched: batchSummary.value.unmatched + res.data.unmatched,
        error: batchSummary.value.error + res.data.error
      }
    } else {
      // 覆盖模式或首次上传
      batchResults.value = res.data.results
      batchSummary.value = {
        matched: res.data.matched,
        unmatched: res.data.unmatched,
        error: res.data.error
      }
    }

    if (res.data.matched > 0) {
      ElMessage.success(`成功匹配 ${res.data.matched} 条记录，证书编号已自动填入`)
      fetchList() // 刷新列表显示证书编号
    } else if (res.data.unmatched > 0) {
      ElMessage.warning(`${res.data.unmatched} 个证书未找到对应器具，请检查出厂编号`)
    }
    // 上传完成后清空文件列表，防止重复上传；保留匹配结果供用户查看
    batchFiles.value = []
  } catch (err) {
    ElMessage.error('批量上传失败：' + (err.response?.data?.message || err.message))
    batchProgress.value = 0
  } finally {
    batchUploading.value = false
  }
}

// 清除匹配结果，保留对话框以便继续上传下一批
function clearBatchResults() {
  batchResults.value = null
  batchSummary.value = { matched: 0, unmatched: 0, error: 0 }
  batchProgress.value = 0
}

// === 未匹配证书处理 ===
function handleUnmatchedAction(cmd, row) {
  activeUnmatched.value = row
  confirmUpdateSerial.value = false
  switch (cmd) {
    case 'search':
      fuzzySearchKeyword.value = ''
      fuzzyCandidates.value = []
      fuzzySearched.value = false
      fuzzyMatchVisible.value = true
      searchFuzzyMatch()
      break
    case 'manual':
      manualSearchKeyword.value = ''
      manualTarget.value = null
      manualMatchVisible.value = true
      loadManualCandidates()
      break
    case 'create':
      newFromCertForm.value = {
        category: row.category || '',
        serialNumber: row.serialNumber || '',
        certificateNumber: row.certificateNumber || '',
        inspectionDate: row.extractedInspectionDate || '',
        validUntil: row.calculatedValidUntil || '',
        classification: '',
        location: ''
      }
      createFromCertVisible.value = true
      break
  }
}

async function searchFuzzyMatch() {
  if (!activeUnmatched.value) return
  fuzzySearching.value = true
  fuzzySearched.value = true
  try {
    const res = await searchUnmatchedCert({
      serialNumber: activeUnmatched.value.serialNumber,
      certificateNumber: activeUnmatched.value.certificateNumber,
      category: activeUnmatched.value.category,
      keyword: fuzzySearchKeyword.value
    })
    fuzzyCandidates.value = res.data.candidates || []
  } catch (err) {
    ElMessage.error('搜索失败：' + (err.response?.data?.message || err.message))
  } finally {
    fuzzySearching.value = false
  }
}

function onFuzzySearchDebounce() {
  if (fuzzySearchTimer) clearTimeout(fuzzySearchTimer)
  fuzzySearchTimer = setTimeout(() => searchFuzzyMatch(), 400)
}

function confirmFuzzyMatch(candidate) {
  confirmMatchTarget.value = candidate
  confirmUpdateSerial.value = candidate.similarity < 1
  confirmMatchVisible.value = true
}

async function executeForceMatch() {
  if (!activeUnmatched.value || !confirmMatchTarget.value) return
  forceMatching.value = true
  try {
    const res = await forceMatchCert({
      certificateSerialNumber: activeUnmatched.value.serialNumber,
      certificateNumber: activeUnmatched.value.certificateNumber,
      category: activeUnmatched.value.category,
      targetInstrumentId: confirmMatchTarget.value.id,
      updateSerialNumber: confirmUpdateSerial.value,
      tempFilePath: activeUnmatched.value.tempFilePath,
      inspectionDate: activeUnmatched.value.extractedInspectionDate || null,
      validUntil: activeUnmatched.value.calculatedValidUntil || null
    })
    ElMessage.success(res.message || '已关联证书')
    confirmMatchVisible.value = false
    fuzzyMatchVisible.value = false
    manualMatchVisible.value = false
    // 从 batchResults 中移除已处理的条目
    if (batchResults.value) {
      const idx = batchResults.value.findIndex(r => r === activeUnmatched.value)
      if (idx >= 0) {
        batchResults.value[idx].status = 'matched'
        batchResults.value[idx].matchedInstrument = { serial_number: confirmMatchTarget.value.serial_number }
        batchSummary.value.matched++
        batchSummary.value.unmatched--
      }
    }
    fetchList()
  } catch (err) {
    ElMessage.error('修正失败：' + (err.response?.data?.message || err.message))
  } finally {
    forceMatching.value = false
  }
}

async function loadManualCandidates() {
  manualSearching.value = true
  try {
    const keyword = manualSearchKeyword.value || ''
    const res = await getInstruments({ pageSize: 50, keyword: keyword || undefined })
    manualCandidates.value = res.data.list || []
  } catch (err) {
    ElMessage.error('加载失败：' + (err.response?.data?.message || err.message))
  } finally {
    manualSearching.value = false
  }
}

function onManualSearch() {
  loadManualCandidates()
}

function selectManualTarget(row) {
  manualTarget.value = row
}

function confirmManualMatch() {
  if (!manualTarget.value) return
  confirmMatchTarget.value = manualTarget.value
  confirmUpdateSerial.value = true
  confirmMatchVisible.value = true
}

async function executeCreateFromCert() {
  const form = newFromCertForm.value
  if (!form.category) { ElMessage.warning('请选择器具类别'); return }
  creatingFromCert.value = true
  try {
    const res = await createInstrumentFromCert({
      serialNumber: form.serialNumber,
      certificateNumber: form.certificateNumber,
      category: form.category,
      inspectionDate: form.inspectionDate || null,
      validUntil: form.validUntil || null,
      classification: form.classification || null,
      location: form.location || '',
      tempFilePath: activeUnmatched.value?.tempFilePath
    })
    ElMessage.success(res.message || '已创建器具并关联证书')
    createFromCertVisible.value = false
    // 标记已处理
    if (batchResults.value && activeUnmatched.value) {
      const idx = batchResults.value.findIndex(r => r === activeUnmatched.value)
      if (idx >= 0) {
        batchResults.value[idx].status = 'matched'
        batchResults.value[idx].matchedInstrument = { serial_number: form.serialNumber }
        batchSummary.value.matched++
        batchSummary.value.unmatched--
      }
    }
    fetchList()
  } catch (err) {
    ElMessage.error('创建失败：' + (err.response?.data?.message || err.message))
  } finally {
    creatingFromCert.value = false
  }
}

// === 多条匹配处理 ===
function openMultiMatchDialog(row) {
  multiMatchCert.value = row
  multiMatchSelected.clear()
  // 默认勾选同类别且编号匹配的
  row.matchedInstruments?.forEach(inst => {
    if (inst.categoryMatch !== false) multiMatchSelected.add(inst.id)
  })
  multiMatchVisible.value = true
}

function toggleMultiSelect(id) {
  if (multiMatchSelected.has(id)) multiMatchSelected.delete(id)
  else multiMatchSelected.add(id)
}

function getMmDateColor(date) {
  if (!date) return '#909399'
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000)
  return diff < 0 ? '#ef4444' : diff <= 30 ? '#f59e0b' : '#059669'
}

async function executeMultiMatch() {
  if (!multiMatchCert.value || multiMatchSelected.size === 0) return
  multiMatching.value = true
  try {
    const res = await confirmCertMatch({
      tempFilePath: multiMatchCert.value.tempFilePath,
      certificateNumber: multiMatchCert.value.certificateNumber,
      serialNumber: multiMatchCert.value.serialNumber,
      category: multiMatchCert.value.category,
      selectedInstrumentIds: [...multiMatchSelected],
      inspectionDate: multiMatchCert.value.extractedInspectionDate || null,
      validUntil: multiMatchCert.value.calculatedValidUntil || null
    })
    ElMessage.success(res.message || '已更新')
    multiMatchVisible.value = false
    // 从 batchResults 中移除已处理条目
    if (batchResults.value) {
      const idx = batchResults.value.findIndex(r => r === multiMatchCert.value)
      if (idx >= 0) {
        batchResults.value[idx].status = 'matched'
        batchSummary.value.matched++
        batchSummary.value.unmatched--
      }
    }
    fetchList()
  } catch (err) {
    ElMessage.error('确认失败：' + (err.response?.data?.message || err.message))
  } finally {
    multiMatching.value = false
  }
}

// === 证书日期校验 ===
function openCertCheck() {
  certCheckVisible.value = true
  certCheckSelected.value = []
  // loadCertCheck 由 @open 自动调用
}

async function loadCertCheck() {
  certCheckLoading.value = true
  certCheckSelected.value = []
  try {
    const params = { pageSize: 500 }
    if (certCheckOnlyMismatch.value) params.onlyMismatch = '1'
    const res = await checkCertDates(params)
    certCheckData.value = res.data
  } catch (err) {
    ElMessage.error('校验失败：' + (err.response?.data?.message || err.message))
  } finally {
    certCheckLoading.value = false
  }
}

async function handleBatchUpdateDates() {
  if (certCheckSelected.value.length === 0) {
    ElMessage.warning('请先选择要更新的记录')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定更新选中的 ${certCheckSelected.value.length} 条记录的检验日期和有效日期吗？`,
      '确认批量更新',
      { confirmButtonText: '确定更新', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  try {
    const items = certCheckSelected.value.map(r => {
      const item = { id: r.id }
      // 维度一：证书日期需要更新 → 更新检验日期
      const needCertFix = r.cert_status === 'cert_mismatch' || r.cert_status === 'cert_missing'
      if (needCertFix && r.extracted_date) {
        item.inspection_date = r.extracted_date
        // 证书日期更新后，有效日期也跟证书日期走
        if (r.cert_expected_valid_until) item.valid_until = r.cert_expected_valid_until
      }
      // 维度二：有效日期不匹配 → 用预期值修正
      const needValidFix = r.valid_status === 'valid_mismatch' || r.valid_status === 'valid_missing'
      if (needValidFix && r.expected_valid_until && !item.valid_until) {
        item.valid_until = r.expected_valid_until
      }
      return item
    })
    const res = await batchUpdateCertDates({ items })
    ElMessage.success(res.message || `成功更新 ${res.data.updated} 条记录`)
    certCheckSelected.value = []
    await loadCertCheck()
    fetchList()
  } catch (err) {
    ElMessage.error('批量更新失败：' + (err.response?.data?.message || err.message))
  }
}

// === 查看证书附件 ===
function viewCertificate(row) {
  const url = photoUrlWithToken(row.certificate_file)
  window.open(url, '_blank')
}

async function handleSingleCertUpload(row, event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await uploadCertificateForInstrument(row.id, file)
    ElMessage.success('证书上传成功')
    fetchList()
  } catch (err) {
    ElMessage.error('上传失败：' + (err.response?.data?.message || err.message))
  }
  event.target.value = ''
}

// 保存台账（导出多Sheet Excel）
async function viewLedger() {
  try {
    const res = await getLedgerInfo()
    if (res.data.exists) {
      window.open('/api/instruments/ledger?token=' + authStore.token, '_blank')
    } else {
      ElMessage.warning('尚未上传台账总表，请先上传')
    }
  } catch (_) {
    ElMessage.error('检查台账总表失败')
  }
}

function handleLedgerFileChange(file) { ledgerFile.value = file.raw }
function handleLedgerFileRemove() { ledgerFile.value = null }
async function handleUploadLedger() {
  if (!ledgerFile.value) return
  uploadingLedger.value = true
  try {
    const res = await uploadLedger(ledgerFile.value)
    ElMessage.success(res.message || '台账总表已保存')
    uploadLedgerDialog.value = false
    ledgerFile.value = null
    ledgerUploadRef.value?.clearFiles()
  } catch (err) {
    ElMessage.error('上传失败：' + (err.response?.data?.message || err.message))
  } finally {
    uploadingLedger.value = false
  }
}

// === 有效日期规则配置 ===
function openRulesConfig() {
  rulesConfigVisible.value = true
}

async function loadRules() {
  rulesLoading.value = true
  try {
    const res = await getValidityRules()
    rulesList.value = res.data.rules
  } catch (err) {
    ElMessage.error('加载规则失败')
  } finally {
    rulesLoading.value = false
  }
}

function openRuleForm(rule) {
  if (rule) {
    editingRule.value = rule
    ruleForm.category = rule.category
    ruleForm.classification = rule.classification
    ruleForm.period_value = rule.period_value
    ruleForm.period_unit = rule.period_unit
    ruleForm.priority = rule.priority
  } else {
    editingRule.value = null
    ruleForm.category = ''
    ruleForm.classification = null
    ruleForm.period_value = 1
    ruleForm.period_unit = 'year'
    ruleForm.priority = 0
  }
  ruleFormVisible.value = true
}

async function saveRule() {
  if (!ruleForm.category) { ElMessage.warning('请选择或输入类别'); return }
  try {
    if (editingRule.value) {
      await updateValidityRule(editingRule.value.id, { ...ruleForm })
      ElMessage.success('规则更新成功')
    } else {
      await createValidityRule({ ...ruleForm })
      ElMessage.success('规则添加成功')
    }
    ruleFormVisible.value = false
    await loadRules()
  } catch (err) {
    ElMessage.error('保存失败：' + (err.response?.data?.message || err.message))
  }
}

async function handleDeleteRule(rule) {
  if (rule.category === '*' && rule.classification === null) {
    ElMessage.warning('默认兜底规则不可删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除规则「${rule.category === '*' ? '默认' : rule.category}」吗？`, '确认删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch { return }
  try {
    await deleteValidityRule(rule.id)
    ElMessage.success('删除成功')
    await loadRules()
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

async function handleResetRules() {
  try {
    await ElMessageBox.confirm('确定重置为默认规则吗？所有自定义规则将被清除。', '确认重置', {
      confirmButtonText: '确认重置', cancelButtonText: '取消', type: 'warning'
    })
  } catch { return }
  try {
    const res = await resetValidityRules()
    rulesList.value = res.data.rules
    ElMessage.success('已重置为默认规则')
  } catch (err) {
    ElMessage.error('重置失败')
  }
}

// === 拍照查找 ===
async function handlePhotoSearchFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }

  if (photoSearchPreview.value) URL.revokeObjectURL(photoSearchPreview.value)
  photoSearchPreview.value = URL.createObjectURL(file)
  photoSearchLoading.value = true
  photoSearchResult.value = null

  try {
    // 上传照片 + OCR
    const ocrRes = await uploadPhoto(file)  // 先上传
    const result = await ocrFromUrl(ocrRes.data.photo_url)

    const extracted = result.data?.extracted
    const serialNumber = extracted?.serial_number

    if (!serialNumber) {
      photoSearchResult.value = { found: false }
      ElMessage.info('未能从照片中识别到出厂编号，请尝试更清晰的照片')
      return
    }

    // 用识别出的出厂编号查找
    const searchRes = await getInstruments({ keyword: serialNumber, pageSize: 50 })
    if (searchRes.data.list && searchRes.data.list.length > 0) {
      photoSearchResult.value = { found: true, instrument: searchRes.data.list[0] }
      ElMessage.success(`已找到：${searchRes.data.list[0].serial_number}`)
    } else {
      photoSearchResult.value = { found: false }
      ElMessage.warning(`未找到出厂编号为 "${serialNumber}" 的器具`)
    }
  } catch (err) {
    ElMessage.error('识别失败，请检查照片清晰度后重试')
  } finally {
    photoSearchLoading.value = false
    event.target.value = ''
  }
}

function goToPhotoSearchResult() {
  if (photoSearchResult.value?.instrument) {
    photoSearchVisible.value = false
    router.push('/instruments/' + photoSearchResult.value.instrument.id)
  }
}

onMounted(async () => {
  try {
    const catRes = await getCategories()
    if (catRes.data && catRes.data.length > 0) {
      categories.value = catRes.data
    }
  } catch (e) { /* use default */ }

  // 从URL参数恢复筛选条件
  const q = route.query
  if (q.keyword) filters.keyword = q.keyword
  if (q.category) filters.category = q.category
  if (q.status) filters.status = q.status
  if (q.classification) filters.classification = q.classification
  if (q.validDate) {
    filters.validDate = q.validDate
  }
  if (q.inspectionDate) {
    filters.inspectionDate = q.inspectionDate
  }

  fetchList()
})
</script>

<style scoped>
.instrument-list-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* ============ 筛选卡片 ============ */
.filter-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
  overflow: hidden;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.filter-header h4 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.filter-header-actions {
  display: flex;
  gap: 8px;
}

.filter-body {
  padding: 16px 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.filter-search-input {
  flex: 1 1 260px;
  min-width: 200px;
}

.filter-spacer {
  flex: 1 1 20px;
  min-width: 0;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
}

.filter-tags-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 4px;
}

/* ============ 表格卡片 ============ */
.table-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.table-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scroll-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: default;
  user-select: none;
}

.select-all-badge {
  font-size: 13px;
  font-weight: 600;
  color: #059669;
  white-space: nowrap;
  padding: 2px 10px;
  background: #ecfdf5;
  border-radius: 12px;
  border: 1px solid #a7f3d0;
}

/* 表格样式 */
.modern-table :deep(.el-table__header),
.modern-table :deep(.el-table__body) {
  table-layout: fixed;
}

.modern-table :deep(.el-table__header th) {
  background: #f1f5f9 !important;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
}

.modern-table :deep(.el-table__body td) {
  font-size: 13px;
}

.serial-number {
  font-weight: 500;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  color: var(--primary);
}

.cert-number {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.change-info-cell { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.updated-tag { flex-shrink: 0; cursor: pointer; }
.change-meta { display: block; max-width: 100%; margin-top: 3px; padding: 0; border: 0; background: transparent; color: #16a34a; font: inherit; font-size: 11px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.change-meta:hover { text-decoration: underline; }

.no-photo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f1f5f9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.valid-tag {
  font-weight: 600;
}

.status-dot-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.status-active      { background: #f0fdf4; color: #16a34a; }
.status-scrapped     { background: #f1f5f9; color: #64748b; }
.status-borrowed     { background: #fffbeb; color: #d97706; }
.status-maintenance  { background: #fef2f2; color: #dc2626; }

/* ============ 类别标签 ============ */
.category-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  border: 1px solid;
  white-space: nowrap;
}

/* ============ 分类管理标识 ============ */
.classification-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.classification-a {
  background: #fee2e2;
  color: #dc2626;
}

.classification-b {
  background: #fef3c7;
  color: #b45309;
}

.classification-c {
  background: #dbeafe;
  color: #1d4ed8;
}

.classification-empty {
  color: #cbd5e1;
  font-size: 12px;
}

/* 表格底部 */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
}

.table-info {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.table-footer :deep(.el-pagination) {
  flex-shrink: 0;
}

/* ============ 表格滚动容器 ============ */
.table-scroll-wrapper {
  /* el-table 的 max-height 属性已经控制垂直滚动，此处仅做微调 */
}

/* 增强横向滚动条 — 始终可见 + 更高（适用于 el-table 内部滚动） */
.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal) {
  height: 10px !important;
  opacity: 1 !important;
}

.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb) {
  height: 8px !important;
  background: #cbd5e1 !important;
  border-radius: 4px !important;
  min-width: 60px !important;
  opacity: 0.85 !important;
}

.table-scroll-wrapper :deep(.el-scrollbar__bar.is-horizontal > .el-scrollbar__thumb:hover) {
  background: #94a3b8 !important;
  height: 10px !important;
}

/* 兼容原生滚动条 */
.table-scroll-wrapper::-webkit-scrollbar {
  height: 10px;
  width: 8px;
}

.table-scroll-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 5px;
}

.table-scroll-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 5px;
  min-width: 60px;
}

.table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ============ 拍照查找 ============ */
.photo-search-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.photo-search-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.photo-search-preview {
  text-align: center;
  background: #f8fafc;
  border-radius: 12px;
  padding: 8px;
}

.photo-search-actions {
  display: flex;
  gap: 12px;
}

.photo-search-match {
  margin-top: 12px;
  padding: 12px;
  background: #f0fdf4;
  border-radius: 8px;
}

.match-row {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
}

.match-row strong {
  color: var(--text-secondary);
  display: inline-block;
  width: 80px;
}

/* ============ 批量上传证书 ============ */
.batch-cert-body {
  display: flex;
  flex-direction: column;
}

.upload-drag-area {
  padding: 32px 20px;
  text-align: center;
}

.upload-drag-area p {
  font-size: 14px;
  color: #606266;
  margin: 8px 0 0;
}

.upload-drag-area em {
  color: #409EFF;
  font-style: normal;
}

.upload-hint {
  font-size: 12px !important;
  color: #c0c4cc !important;
}

.results-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ============ 日期列筛选 ============ */
.date-col-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: default;
}

.date-filter-icon {
  cursor: pointer;
  color: #c0c4cc;
  transition: color 0.2s;
  flex-shrink: 0;
}

.date-filter-icon:hover {
  color: #409EFF;
}

.date-filter-icon.filter-active {
  color: #409EFF;
}

.date-filter-popover {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.date-filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ============ 响应式 ============ */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  .filter-search-input {
    width: 100%;
  }
}

/* 多条匹配选择 */
.multi-match-list { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; }
.multi-match-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px;
  border: 1px solid #e4e7ed; border-radius: 8px; cursor: pointer; transition: all 0.2s;
}
.multi-match-item:hover { border-color: var(--primary-light); }
.multi-match-item.selected { border-color: var(--primary); background: #eff6ff; }
.multi-match-item.mismatch { border-color: #fef0f0; background: #fefafa; }
.mm-info { flex: 1; min-width: 0; }
.mm-line1 { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.mm-category { font-weight: 600; font-size: 13px; }
.mm-serial { font-size: 12px; color: var(--primary); background: #eff6ff; padding: 1px 6px; border-radius: 3px; }
.mm-line2 { display: flex; gap: 12px; font-size: 12px; color: #606266; margin-bottom: 3px; }
.mm-line3 { display: flex; gap: 12px; font-size: 12px; color: #909399; }
</style>
