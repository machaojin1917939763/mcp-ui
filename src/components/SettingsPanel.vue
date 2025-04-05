<template>
  <div>
    <transition name="settings-fade">
      <div 
        class="overlay settings-overlay" 
        v-if="showSettings" 
        @click="closeSettings"
      ></div>
    </transition>
    
    <transition name="settings-slide">
      <div class="settings-panel" v-if="showSettings">
        <!-- 关闭按钮 -->
        <button class="close-settings-btn" @click="closeSettings" title="关闭设置面板">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <!-- 设置菜单 -->
        <div class="settings-menu">
          <div 
            class="settings-menu-item" 
            :class="{ active: settingsTab === 'api' }"
            @click="settingsTab = 'api'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M8 21h8"></path>
              <path d="M12 17v4"></path>
            </svg>
            <span>API设置</span>
          </div>
          <div 
            class="settings-menu-item" 
            :class="{ active: settingsTab === 'appearance' }"
            @click="settingsTab = 'appearance'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 5v2"></path>
              <path d="M12 17v2"></path>
              <path d="M5 12h2"></path>
              <path d="M17 12h2"></path>
              <path d="M19.071 4.929l-1.414 1.414"></path>
              <path d="M6.343 17.657l-1.414 1.414"></path>
              <path d="M19.071 19.071l-1.414-1.414"></path>
              <path d="M6.343 6.343l-1.414-1.414"></path>
            </svg>
            <span>外观设置</span>
          </div>
          <div 
            class="settings-menu-item" 
            :class="{ active: settingsTab === 'mcp' }"
            @click="settingsTab = 'mcp'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            <span>MCP服务器</span>
          </div>
          <div 
            class="settings-menu-item" 
            :class="{ active: settingsTab === 'about' }"
            @click="settingsTab = 'about'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            <span>关于</span>
          </div>
        </div>
        
        <!-- 内容区域 -->
        <div class="settings-content-wrapper">
          <transition name="fade" mode="out-in">
            <!-- API设置页面 -->
            <div class="settings-content" v-if="settingsTab === 'api'" key="api">
              <h3>API设置</h3>
              
              <div class="settings-group">
                <label for="provider">模型提供商:</label>
                <select 
                  id="provider" 
                  :value="providerId" 
                  @change="updateProviderId($event.target.value)" 
                  class="styled-select"
                >
                  <option v-for="provider in MODEL_PROVIDERS" :key="provider.id" :value="provider.id">
                    {{ provider.name }}
                  </option>
                </select>
              </div>
              
              <!-- 当选择自定义提供商时显示自定义设置 -->
              <div v-if="providerId === 'custom'" class="settings-group custom-provider-section">
                <label for="customBaseUrl">自定义API基础URL:</label>
                <input 
                  type="text" 
                  id="customBaseUrl" 
                  :value="customBaseUrl" 
                  @input="updateCustomBaseUrl($event.target.value)"
                  placeholder="例如: https://api.example.com/v1"
                  class="styled-input"
                />
                
                <!-- 自定义提供商API密钥输入框 -->
                <div class="api-key-section">
                  <label for="customApiKey">自定义API密钥:</label>
                  <input 
                    type="password" 
                    id="customApiKey" 
                    :value="providerApiKeys['custom'] || ''" 
                    @input="updateProviderApiKey('custom', $event.target.value)"
                    placeholder="输入API密钥" 
                    class="styled-input"
                  />
                  <small>当前API密钥: {{ getMaskedApiKey('custom') || '未设置' }}</small>
                </div>
                
                <label class="mt-3">模型列表:</label>
                <div class="custom-models-container">
                  <div class="custom-models-list">
                    <!-- 显示所有系统模型 -->
                    <div v-for="model in availableModels" :key="model.id" class="custom-model-item">
                      <div class="custom-model-details">
                        <div class="custom-model-id">{{ model.id }}</div>
                        <div class="custom-model-name">{{ model.name }}</div>
                      </div>
                      <div class="custom-model-actions">
                        <button 
                          class="model-select-btn" 
                          :class="{ active: customModelId === model.id }"
                          @click="updateCustomModelId(model.id)"
                        >
                          {{ customModelId === model.id ? '已选择' : '选择' }}
                        </button>
                      </div>
                    </div>
                    
                    <!-- 显示用户添加的自定义模型 -->
                    <div v-for="model in customModels" :key="model.id" class="custom-model-item">
                      <div class="custom-model-details">
                        <div class="custom-model-id">{{ model.id }}</div>
                        <div class="custom-model-name">{{ model.name }}</div>
                      </div>
                      <div class="custom-model-actions">
                        <button 
                          class="model-select-btn" 
                          :class="{ active: customModelId === model.id }"
                          @click="updateCustomModelId(model.id)"
                        >
                          {{ customModelId === model.id ? '已选择' : '选择' }}
                        </button>
                        <button class="model-delete-btn" @click="removeCustomModel(model.id)">
                          删除
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="add-model-section">
                    <h4>添加新模型</h4>
                    <div class="add-model-form">
                      <input 
                        type="text" 
                        :value="newCustomModelId" 
                        @input="updateNewCustomModelId($event.target.value)"
                        placeholder="模型ID (必填)" 
                        class="add-model-input"
                      />
                      <input 
                        type="text" 
                        :value="newCustomModelName" 
                        @input="updateNewCustomModelName($event.target.value)"
                        placeholder="模型名称 (可选)" 
                        class="add-model-input"
                      />
                      <input 
                        type="text" 
                        :value="newCustomModelDesc" 
                        @input="updateNewCustomModelDesc($event.target.value)"
                        placeholder="模型描述 (可选)" 
                        class="add-model-input"
                      />
                    </div>
                    <button 
                      class="add-model-button" 
                      type="button"
                      @click="addCustomModel" 
                      :disabled="!newCustomModelId.trim()"
                    >
                      添加模型
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- 当不是自定义提供商时显示模型下拉列表 -->
              <div v-else class="settings-group">
                <label for="model">模型:</label>
                <select 
                  id="model" 
                  :value="modelId" 
                  @change="updateModelId($event.target.value)" 
                  class="styled-select"
                >
                  <option v-for="model in availableModels" :key="model.id" :value="model.id">
                    {{ model.id }} - {{ model.name }}
                  </option>
                </select>
                <div class="model-description" v-if="modelId && currentModelDescription">
                  {{ currentModelDescription }}
                </div>
                
                <!-- 当前选择的提供商的API密钥 -->
                <div class="api-key-section">
                  <label :for="`${providerId}ApiKey`">API密钥:</label>
                  <input 
                    type="password" 
                    :id="`${providerId}ApiKey`" 
                    :value="providerApiKeys[providerId] || ''" 
                    @input="updateProviderApiKey(providerId, $event.target.value)"
                    placeholder="输入API密钥" 
                    class="styled-input"
                  />
                  <small>当前API密钥: {{ getMaskedApiKey(providerId) || '未设置' }}</small>
                </div>
                
                <!-- 添加模型功能 -->
                <label class="mt-3">模型列表:</label>
                <div class="custom-models-container">
                  <div class="custom-models-list">
                    <!-- 显示系统提供的模型 -->
                    <div v-for="model in availableModels" :key="model.id" class="custom-model-item">
                      <div class="custom-model-details">
                        <div class="custom-model-id">{{ model.id }}</div>
                        <div class="custom-model-name">{{ model.name }}</div>
                      </div>
                      <div class="custom-model-actions">
                        <button 
                          class="model-select-btn" 
                          :class="{ active: modelId === model.id }"
                          @click="updateModelId(model.id)"
                        >
                          {{ modelId === model.id ? '已选择' : '选择' }}
                        </button>
                      </div>
                    </div>
                    
                    <!-- 显示用户添加的模型 -->
                    <div v-for="model in providerModels[providerId] || []" :key="model.id" class="custom-model-item">
                      <div class="custom-model-details">
                        <div class="custom-model-id">{{ model.id }}</div>
                        <div class="custom-model-name">{{ model.name }}</div>
                      </div>
                      <div class="custom-model-actions">
                        <button 
                          class="model-select-btn" 
                          :class="{ active: modelId === model.id }"
                          @click="updateModelId(model.id)"
                        >
                          {{ modelId === model.id ? '已选择' : '选择' }}
                        </button>
                        <button class="model-delete-btn" @click="removeCustomModel(model.id)">
                          删除
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="add-model-section">
                    <h4>添加新模型</h4>
                    <div class="add-model-form">
                      <input 
                        type="text" 
                        :value="newCustomModelId" 
                        @input="updateNewCustomModelId($event.target.value)"
                        placeholder="模型ID (必填)" 
                        class="add-model-input"
                      />
                      <input 
                        type="text" 
                        :value="newCustomModelName" 
                        @input="updateNewCustomModelName($event.target.value)"
                        placeholder="模型名称 (可选)" 
                        class="add-model-input"
                      />
                      <input 
                        type="text" 
                        :value="newCustomModelDesc" 
                        @input="updateNewCustomModelDesc($event.target.value)"
                        placeholder="模型描述 (可选)" 
                        class="add-model-input"
                      />
                    </div>
                    <button 
                      class="add-model-button" 
                      type="button"
                      @click="addCustomModel" 
                      :disabled="!newCustomModelId.trim()"
                    >
                      添加模型
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- 添加保存按钮 -->
              <div class="settings-group save-btn-group">
                <button 
                  class="save-settings-button" 
                  type="button" 
                  @click="emit('save-settings')"
                >
                  保存设置
                </button>
              </div>
            </div>
            
            <!-- MCP服务器设置页面 -->
            <div class="settings-content" v-else-if="settingsTab === 'mcp'" key="mcp">
              <h3>MCP服务器设置</h3>
              
              <div class="mcp-description">
                <p>MCP (Model Context Protocol) 是一种协议，允许AI模型通过工具与外部系统进行交互。</p>
                <p>您可以配置多个MCP服务器，以便AI可以使用它们提供的工具。</p>
              </div>
              
              <div class="settings-group">
                <div class="add-server-header">
                  <h4>添加新MCP服务器</h4>
                  <button 
                    type="button" 
                    class="toggle-add-form-btn" 
                    @click="toggleAddServerForm"
                  >
                    <svg v-if="!showAddServerForm" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 5v14M5 12h14"></path>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14"></path>
                    </svg>
                    {{ showAddServerForm ? '收起' : '添加服务器' }}
                  </button>
                </div>
                
                <transition name="slide-fade">
                  <div class="add-mcp-server-form" v-if="showAddServerForm">
                    <div class="input-group">
                      <label for="mcpServerId">服务器ID:</label>
                      <input 
                        type="text" 
                        id="mcpServerId" 
                        :value="newMcpServerId" 
                        @input="updateNewMcpServerId($event.target.value)"
                        placeholder="唯一标识符，如：weather" 
                        class="styled-input"
                      />
                    </div>
                    <div class="input-group">
                      <label for="mcpServerName">服务器名称:</label>
                      <input 
                        type="text" 
                        id="mcpServerName" 
                        :value="newMcpServerName" 
                        @input="updateNewMcpServerName($event.target.value)"
                        placeholder="显示名称，如：天气服务" 
                        class="styled-input"
                      />
                    </div>
                    
                    <!-- 传输方式选择 -->
                    <div class="input-group">
                      <label for="mcpServerTransport">传输方式:</label>
                      <div class="transport-options">
                        <div 
                          class="transport-option" 
                          :class="{ active: newMcpServerTransport === 'sse' }"
                          @click="updateNewMcpServerTransport('sse')"
                        >
                          <div class="transport-radio">
                            <div class="radio-inner" v-if="newMcpServerTransport === 'sse'"></div>
                          </div>
                          <div class="transport-info">
                            <div class="transport-name">SSE</div>
                            <div class="transport-desc">Server-Sent Events - 适用于基于HTTP的服务器</div>
                          </div>
                        </div>
                        <div 
                          class="transport-option" 
                          :class="{ active: newMcpServerTransport === 'stdio' }"
                          @click="updateNewMcpServerTransport('stdio')"
                        >
                          <div class="transport-radio">
                            <div class="radio-inner" v-if="newMcpServerTransport === 'stdio'"></div>
                          </div>
                          <div class="transport-info">
                            <div class="transport-name">STDIO</div>
                            <div class="transport-desc">标准输入/输出 - 适用于本地运行的进程</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- SSE类型特有的配置 -->
                    <div v-if="newMcpServerTransport === 'sse'" class="transport-config sse-config">
                    <div class="input-group">
                      <label for="mcpServerUrl">服务器URL:</label>
                      <input 
                        type="text" 
                        id="mcpServerUrl" 
                        :value="newMcpServerUrl" 
                        @input="updateNewMcpServerUrl($event.target.value)"
                        placeholder="例如：http://localhost:8080" 
                        class="styled-input"
                      />
                    </div>
                    </div>
                    
                    <!-- STDIO类型特有的配置 -->
                    <div v-if="newMcpServerTransport === 'stdio'" class="transport-config stdio-config">
                      <div class="input-group">
                        <label for="mcpServerCommand">命令:</label>
                        <input 
                          type="text" 
                          id="mcpServerCommand" 
                          :value="newMcpServerCommand" 
                          @input="updateNewMcpServerCommand($event.target.value)"
                          placeholder="如：python, node, uv等" 
                          class="styled-input"
                        />
                      </div>
                      
                      <div class="input-group">
                        <label>参数列表:</label>
                        <div class="args-list">
                          <div v-for="(arg, idx) in newMcpServerArgs" :key="idx" class="arg-item">
                            <input 
                              type="text" 
                              :value="arg" 
                              @input="updateMcpServerArg(idx, $event.target.value)"
                              placeholder="参数" 
                              class="styled-input arg-input"
                            />
                            <button 
                              type="button" 
                              class="arg-remove-btn" 
                              @click="removeMcpServerArg(idx)"
                              aria-label="删除参数"
                            >
                              &times;
                            </button>
                          </div>
                          <button 
                            type="button" 
                            class="add-arg-btn" 
                            @click="addMcpServerArg"
                          >
                            添加参数
                          </button>
                        </div>
                        <div class="args-tip">
                          <small>提示: 对于目录路径，请使用绝对路径。例如参数：<code>--directory</code>, <code>/path/to/folder</code>, <code>run</code>, <code>script.py</code></small>
                        </div>
                      </div>
                      
                      <div class="config-example">
                        <div class="example-header">Claude桌面版配置示例：</div>
                        <pre class="config-json">{
    "mcpServers": {
      "{{ newMcpServerId || 'weather' }}": {
        "command": "{{ newMcpServerCommand || 'uv' }}",
        "args": {{ newMcpServerArgs.length ? JSON.stringify(newMcpServerArgs, null, 2) : '[\n    "--directory",\n    "/path/to/folder",\n    "run",\n    "script.py"\n  ]' }}
      }
    }
  }</pre>
                      </div>
                    </div>
                    
                    <div class="input-group">
                      <label for="mcpServerDesc">服务器描述 (可选):</label>
                      <input 
                        type="text" 
                        id="mcpServerDesc" 
                        :value="newMcpServerDesc" 
                        @input="updateNewMcpServerDesc($event.target.value)"
                        placeholder="这个服务器提供什么功能？" 
                        class="styled-input"
                      />
                    </div>

                    <button 
                      type="button" 
                      class="add-server-button" 
                      @click="addMcpServer"
                      :disabled="(newMcpServerTransport === 'sse' && !newMcpServerUrl.trim()) || 
                                 (newMcpServerTransport === 'stdio' && !newMcpServerCommand.trim()) || 
                                 !newMcpServerId.trim()"
                    >
                      添加服务器
                    </button>
                  </div>
                </transition>
              </div>
              
              <div class="settings-group">
                <h4>已配置的MCP服务器</h4>
                <div class="mcp-servers-list">
                  <div v-if="mcpServers.length === 0" class="no-servers">
                    <p>暂无配置的服务器。请添加一个新服务器。</p>
                  </div>
                  <div 
                    v-for="(server, index) in mcpServers" 
                    :key="server.id" 
                    class="mcp-server-item-wrapper"
                  >
                    <div class="mcp-server-item">
                      <div class="mcp-server-details">
                        <div class="mcp-server-header">
                          <div class="mcp-server-name">{{ server.name }}</div>
                          <div class="mcp-server-status" :class="{ enabled: server.enabled }">
                            {{ server.enabled ? '已启用' : '已禁用' }}
                          </div>
                        </div>
                        
                        <div class="mcp-server-id">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          ID: {{ server.id }}
                        </div>
                        
                        <!-- SSE类型显示URL -->
                        <div v-if="server.transport === 'sse'" class="mcp-server-url">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                          </svg>
                          URL: {{ server.url }}
                        </div>
                        
                        <!-- STDIO类型显示命令和参数 -->
                        <div v-if="server.transport === 'stdio'" class="mcp-server-command">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 9h4"></path><path d="M10 13H6"></path><path d="M12 9h6"></path><path d="M18 13h-6"></path>
                            <rect x="2" y="5" width="20" height="12" rx="2"></rect>
                          </svg>
                          命令: {{ server.command }}
                        </div>
                        
                        <div v-if="server.transport === 'stdio' && server.args && server.args.length" class="mcp-server-args">
                          <span>参数:</span>
                          <div class="args-pills">
                            <span 
                              v-for="(arg, idx) in server.args" 
                              :key="idx"
                              class="arg-pill"
                            >
                              {{ arg }}
                            </span>
                          </div>
                        </div>
                        
                        <div class="mcp-server-transport">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                          </svg>
                          传输: {{ server.transport?.toUpperCase() || 'SSE' }}
                        </div>
                        
                        <div v-if="server.description" class="mcp-server-description">
                          {{ server.description }}
                        </div>
                        
                        <!-- 服务器状态信息 -->
                        <div class="mcp-server-status-info" v-if="server.enabled">
                          <div class="status-indicator" :class="{ connected: props.serverConnectionStatus[server.id]?.connected }">
                            <span class="status-dot"></span>
                            <span class="status-text">
                              {{ server.transport === 'stdio' 
                                ? '等待调用' 
                                : (props.serverConnectionStatus[server.id]?.connected ? '已连接' : '未连接') 
                              }}
                            </span>
                            <span class="last-checked" v-if="props.serverConnectionStatus[server.id]?.lastChecked">
                              (最后检查: {{ new Date(props.serverConnectionStatus[server.id]?.lastChecked || 0).toLocaleTimeString() }})
                            </span>
                          </div>
                          
                          <div v-if="server.transport === 'stdio'" class="stdio-info">
                            <div class="stdio-note">
                              <strong>提示:</strong> {{ props.serverConnectionStatus[server.id]?.message || 'STDIO服务器将在您首次调用工具时启动' }}
                            </div>
                          </div>
                        </div>
                        
                        <!-- 服务器工具列表 -->
                        <div class="mcp-server-tools" v-if="server.enabled && props.serverTools[server.id]?.length">
                          <div class="tools-header" @click="toggleToolsList(server.id)">
                            <span>可用工具 ({{ props.serverTools[server.id]?.length || 0 }})</span>
                            <span class="toggle-icon">{{ props.expandedToolServers.includes(server.id) ? '▼' : '▶' }}</span>
                          </div>
                          <div class="tools-list" v-if="props.expandedToolServers.includes(server.id)">
                            <div class="tool-item" v-for="tool in props.serverTools[server.id]" :key="tool.name">
                              <div class="tool-name">{{ tool.name }}</div>
                              <div class="tool-description">{{ tool.description }}</div>
                            </div>
                          </div>
                        </div>
                        
                        <!-- 对于STDIO服务器但没有工具的情况显示提示 -->
                        <div class="mcp-server-tools" v-else-if="server.enabled && server.transport === 'stdio'">
                          <div class="tools-header">
                            <span>工具信息</span>
                          </div>
                          <div class="tools-list">
                            <div class="tool-item">
                              <div class="tool-description">STDIO服务器的工具将在首次调用时加载。当前未知可用工具列表。</div>
                            </div>
                            <div class="tool-item">
                              <button 
                                type="button" 
                                class="load-tools-btn"
                                @click="$emit('request-tools-info', server.id)"
                              >
                                尝试加载工具列表
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="mcp-server-actions">
                        <button 
                          type="button"
                          class="server-toggle-btn" 
                          :class="{ active: server.enabled }"
                          @click.stop.prevent="handleServerStatusChange(server.id)"
                        >
                          <svg v-if="server.enabled" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18.36 6.64A9 9 0 0 1 20.77 15"></path>
                            <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"></path>
                            <path d="M12 2v4"></path>
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18.36 6.64A9 9 0 1 1 5.63 5.63"></path>
                            <path d="M12 2v4"></path>
                          </svg>
                          {{ server.enabled ? '禁用' : '启用' }}
                        </button>
                        <button 
                          type="button"
                          class="server-delete-btn" 
                          @click.stop.prevent="removeMcpServer(server.id)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 外观设置页面 -->
            <div class="settings-content" v-else-if="settingsTab === 'appearance'" key="appearance">
              <h3>外观设置</h3>
              
              <div class="settings-group">
                <label for="codeTheme">代码高亮主题:</label>
                <select 
                  id="codeTheme" 
                  :value="currentTheme" 
                  @change="updateCodeTheme($event.target.value)" 
                  class="styled-select"
                >
                  <option v-for="theme in codeThemes" :key="theme.id" :value="theme.id">
                    {{ theme.name }}
                  </option>
                </select>
                
                <div class="theme-preview">
                  <div class="preview-label">主题预览:</div>
                  <div class="code-block-wrapper preview-code-block">
                    <div class="code-block-header">
                      <span class="code-language">javascript</span>
                      <button class="copy-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>复制</span>
                      </button>
                    </div>
                    <pre><code class="hljs language-javascript">
                          function greeting(name) {
                          console.log(`Hello, ${name}!`);
                          return {
                              message: `欢迎, ${name}`,
                              timestamp: new Date().toLocaleString()
                          };
                          }

                          // 示例对象
                          const user = {
                          name: '张三',
                          age: 28,
                          isActive: true
                          };</code></pre>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 关于页面 -->
            <div class="settings-content" v-else-if="settingsTab === 'about'" key="about">
              <h3>关于 MCP 智能对话</h3>
              
              <div class="about-info">
                <p>MCP 智能对话是一个轻量级的AI对话工具，支持多种大型语言模型。</p>
                <p>版本: 1.0.0</p>
                <p>开发者: MCP Team</p>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, onMounted, nextTick, computed } from 'vue';
import type { ModelInfo } from '../composables';
import type { MCPServerConfig } from '../composables/useMCPSettings';
import { useMCPSettings } from '../composables/useMCPSettings';

// 全局类型声明
declare global {
  interface Window {
    hljs: any;
  }
}

// 代码高亮主题列表
const codeThemes = [
  { id: 'github', name: 'GitHub' },
  { id: 'github-dark', name: 'GitHub Dark' },
  { id: 'atom-one-dark', name: 'Atom One Dark' },
  { id: 'atom-one-light', name: 'Atom One Light' },
  { id: 'vs', name: 'Visual Studio' },
  { id: 'vs2015', name: 'Visual Studio 2015' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'solarized-light', name: 'Solarized Light' },
  { id: 'solarized-dark', name: 'Solarized Dark' }
];

// 当前选择的主题
const currentTheme = ref(localStorage.getItem('codeTheme') || 'github');

// 设置面板标签页
const settingsTab = ref('api'); // 'api', 'appearance', 'about'

// 添加新MCP服务器表单的显示和隐藏
const showAddServerForm = ref(false);

// 优化后的props定义 - 使用computed方法
const props = defineProps({
  showSettings: Boolean,
  apiKey: String,
  providerId: String,
  modelId: String,
  customBaseUrl: String,
  customModelId: String,
  customModels: {
    type: Array as () => ModelInfo[],
    default: () => []
  },
  providerModels: {
    type: Object as () => Record<string, ModelInfo[]>,
    default: () => ({})
  },
  newCustomModelId: String,
  newCustomModelName: String,
  newCustomModelDesc: String,
  MODEL_PROVIDERS: Array,
  availableModels: {
    type: Array as () => ModelInfo[],
    default: () => []
  },
  currentModelDescription: {
    type: String,
    default: ''
  },
  maskedApiKey: {
    type: String,
    default: ''
  },
  // MCP服务器相关
  mcpServers: {
    type: Array as () => MCPServerConfig[],
    default: () => []
  },
  newMcpServerId: String,
  newMcpServerName: String,
  newMcpServerUrl: String,
  newMcpServerDesc: String,
  newMcpServerTransport: String,
  newMcpServerCommand: {
    type: String,
    default: ''
  },
  newMcpServerArgs: {
    type: Array as () => string[],
    default: () => []
  },
  // 服务器状态和工具信息
  serverConnectionStatus: {
    type: Object as () => Record<string, { connected?: boolean; checking?: boolean; error?: string; lastChecked?: number; message?: string }>,
    default: () => ({})
  },
  serverTools: {
    type: Object as () => Record<string, any[]>,
    default: () => ({})
  },
  expandedToolServers: {
    type: Array as () => string[],
    default: () => []
  },
  providerApiKeys: {
    type: Object as () => Record<string, string>,
    default: () => ({})
  }
});

// 定义事件
const emit = defineEmits([
  'update:showSettings',
  'update:apiKey',
  'update:providerId',
  'update:modelId',
  'update:customBaseUrl', 
  'update:customModelId', 
  'update:newCustomModelId',
  'update:newCustomModelName',
  'update:newCustomModelDesc',
  'update:currentTheme',
  // MCP服务器相关
  'update:newMcpServerId',
  'update:newMcpServerName',
  'update:newMcpServerUrl',
  'update:newMcpServerDesc',
  'update:newMcpServerTransport',
  'update:newMcpServerCommand',
  'update-mcp-server-args',
  'add-mcp-server-arg',
  'remove-mcp-server-arg',
  'save-settings',
  'add-custom-model',
  'remove-custom-model',
  'add-mcp-server',
  'toggle-mcp-server-status',
  'remove-mcp-server',
  'request-tools-info',
  'update:expandedToolServers',
  'update:providerApiKey'
]);

// 启用和禁用服务器的计算属性
const enabledServers = computed(() => {
  return props.mcpServers.filter(server => server.enabled);
});

const disabledServers = computed(() => {
  return props.mcpServers.filter(server => !server.enabled);
});

// 更新函数，用于修改设置并自动保存
const updateProviderId = (value: string) => {
  emit('update:providerId', value);
  localStorage.setItem('providerId', value);
  
  // 自动保存设置，确保切换提供商后MCPClient会被更新
  setTimeout(() => {
    emit('save-settings');
  }, 100);
};

const updateModelId = (value: string) => {
  emit('update:modelId', value);
  localStorage.setItem('modelId', value);
};

const updateCustomBaseUrl = (value: string) => {
  emit('update:customBaseUrl', value);
  localStorage.setItem('customBaseUrl', value);
};

const updateCustomModelId = (value: string) => {
  emit('update:customModelId', value);
  localStorage.setItem('customModelId', value);
};

// 更新主题选择
const updateCodeTheme = (theme: string) => {
  currentTheme.value = theme;
  localStorage.setItem('codeTheme', theme);
  loadCodeTheme(theme);
};

// 控制表单显示
const toggleAddServerForm = () => {
  showAddServerForm.value = !showAddServerForm.value;
};

// 切换工具列表显示
function toggleToolsList(serverId: string) {
  if (props.expandedToolServers.includes(serverId)) {
    emit('update:expandedToolServers', props.expandedToolServers.filter(id => id !== serverId));
  } else {
    emit('update:expandedToolServers', [...props.expandedToolServers, serverId]);
  }
}

// 关闭设置面板
const closeSettings = () => {
  emit('update:showSettings', false);
};

// 获取已加密的API密钥
const getMaskedApiKey = (provider: string) => {
  const apiKey = props.providerApiKeys[provider];
  if (!apiKey) return null;
  
  if (apiKey.length <= 8) {
    return '••••••••';
  }
  
  // 显示前4位和后4位，中间用点号替代
  return apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4);
};

// 组件挂载时加载当前主题
onMounted(() => {
  loadCodeTheme(currentTheme.value);
  
  // 高亮当前代码区域
  nextTick(() => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  });
});

// 加载代码高亮主题
function loadCodeTheme(themeId: string) {
  const themeLinks = document.querySelectorAll('link[data-hljs-theme]');
  
  // 移除之前的主题链接
  themeLinks.forEach(link => link.remove());
  
  // 添加新的主题链接
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/${themeId}.min.css`;
  link.setAttribute('data-hljs-theme', themeId);
  document.head.appendChild(link);
  
  // 保存主题选择
  localStorage.setItem('codeTheme', themeId);
  currentTheme.value = themeId;
  emit('update:currentTheme', themeId);
  
  // 重新应用代码高亮
  setTimeout(() => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }, 100);
}

// 更新提供商API密钥
const updateProviderApiKey = (provider: string, value: string) => {
  emit('update:providerApiKey', { [provider]: value });
};

/**
 * 添加模型到当前选中的提供商
 * 父组件需要实现：
 * 1. 当providerId是'custom'时，将模型添加到customModels中
 * 2. 当providerId是其他值时，将模型添加到providerModels[providerId]对象中
 */
// 添加模型
const addCustomModel = () => {
  // 向父组件发送添加模型的事件，并传递当前提供商ID
  emit('add-custom-model', props.providerId);
  
  // 清空输入
  emit('update:newCustomModelId', '');
  emit('update:newCustomModelName', '');
  emit('update:newCustomModelDesc', '');
};

/**
 * 从当前选中的提供商中移除模型
 * 父组件需要实现：
 * 1. 当providerId是'custom'时，从customModels中移除模型
 * 2. 当providerId是其他值时，从providerModels[providerId]对象中移除模型
 */
// 移除模型
const removeCustomModel = (id: string) => {
  // 向父组件发送删除模型的事件，并传递模型ID和当前提供商ID
  emit('remove-custom-model', id, props.providerId);
};

// 添加MCP服务器
const addMcpServer = () => {
  emit('add-mcp-server');
  // 添加后清空表单并隐藏
  showAddServerForm.value = false;
};

// 添加新的方法
const addMcpServerArg = () => {
  emit('add-mcp-server-arg');
};

const removeMcpServerArg = (index: number) => {
  emit('remove-mcp-server-arg', index);
};

const removeMcpServer = (serverId: string) => {
  emit('remove-mcp-server', serverId);
};

// 更新表单字段
const updateNewCustomModelId = (value: string) => {
  emit('update:newCustomModelId', value);
};

const updateNewCustomModelName = (value: string) => {
  emit('update:newCustomModelName', value);
};

const updateNewCustomModelDesc = (value: string) => {
  emit('update:newCustomModelDesc', value);
};

const updateNewMcpServerId = (value: string) => {
  emit('update:newMcpServerId', value);
};

const updateNewMcpServerName = (value: string) => {
  emit('update:newMcpServerName', value);
};

const updateNewMcpServerUrl = (value: string) => {
  emit('update:newMcpServerUrl', value);
};

const updateNewMcpServerDesc = (value: string) => {
  emit('update:newMcpServerDesc', value);
};

const updateNewMcpServerTransport = (value: 'sse' | 'stdio') => {
  emit('update:newMcpServerTransport', value);
};

const updateNewMcpServerCommand = (value: string) => {
  emit('update:newMcpServerCommand', value);
};

const updateMcpServerArg = (index: number, value: string) => {
  emit('update-mcp-server-args', { index, value });
};

// 切换服务器状态
const handleServerStatusChange = (id: string) => {
  emit('toggle-mcp-server-status', id);
};
</script>

<style scoped>
@import '../styles/settings.css';

/* 关闭按钮样式 */
.close-settings-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #f0f0f0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

/* 遮罩层样式覆盖 */
.settings-overlay {
  opacity: 1 !important;
  background-color: rgba(0, 0, 0, 0.5);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.close-settings-btn:hover {
  background-color: #e0e0e0;
  transform: scale(1.05);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.close-settings-btn:active {
  transform: scale(0.98);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.close-settings-btn svg {
  color: #555;
  transition: color 0.2s ease;
}

.close-settings-btn:hover svg {
  color: #222;
}

.api-key-section {
  margin-top: 15px;
  width: 100%;
  border-radius: 8px;
  padding: 15px;
  background-color: #f5f8ff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.api-key-section label {
  margin-bottom: 10px;
  display: block;
  font-weight: 600;
  color: #333;
}

.api-key-section small {
  color: #666;
  margin-top: 6px;
  display: block;
  font-size: 0.85em;
}

/* 保存按钮样式 */
.save-btn-group {
  margin-top: 25px;
  display: flex;
  justify-content: center;
}

.save-settings-button {
  background-color: #1677ff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.save-settings-button:hover {
  background-color: #0958d9;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.save-settings-button:active {
  background-color: #003eb3;
  transform: translateY(0);
}

/* 设置面板内容包装器 */
.settings-content-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  width: 100%;
}

/* 设置面板动画效果 */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0 !important;
  backdrop-filter: blur(0);
}

.settings-slide-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.settings-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.47, 0, 0.75, 0.72), opacity 0.25s ease;
}

.settings-slide-enter-from {
  transform: translateX(100%) !important;
  opacity: 0 !important;
}

.settings-slide-leave-to {
  transform: translateX(100%) !important;
  opacity: 0 !important;
}

/* 设置标签页切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 输入控件优化 */
.styled-select, .styled-input {
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 12px 14px;
}

.styled-select:hover, .styled-input:hover {
  border-color: #1677ff;
}

.styled-select:focus, .styled-input:focus {
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.2);
  border-color: #1677ff;
}

/* 添加模型区域样式优化 */
.add-model-section {
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.add-model-section:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.add-model-button {
  border-radius: 8px;
  transition: all 0.3s ease;
}

/* 服务器项目样式优化 */
.mcp-server-item {
  transition: all 0.2s ease;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid #e5e8f0;
}

.mcp-server-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* 服务器操作按钮 */
.server-toggle-btn, .server-delete-btn {
  transition: all 0.2s ease;
  border-radius: 6px;
}

.server-toggle-btn:hover, .server-delete-btn:hover {
  transform: translateY(-2px);
}

/* 添加上边距工具类 */
.mt-3 {
  margin-top: 1rem;
}

/* 自定义模型容器样式 */
.custom-models-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  background-color: #f9f9f9;
}

.custom-models-list {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 15px;
}

.custom-model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.custom-model-item:last-child {
  border-bottom: none;
}

.custom-model-details {
  flex: 1;
}

.custom-model-id {
  font-weight: 600;
  font-size: 0.9rem;
}

.custom-model-name {
  color: #666;
  font-size: 0.85rem;
  margin-top: 2px;
}

.custom-model-actions {
  display: flex;
  gap: 8px;
}

.model-select-btn, .model-delete-btn {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: white;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.model-select-btn:hover, .model-delete-btn:hover {
  background-color: #f0f0f0;
}

.model-select-btn.active {
  background-color: #e6f7ff;
  border-color: #1677ff;
  color: #1677ff;
}

.model-delete-btn {
  color: #ff4d4f;
}

.model-delete-btn:hover {
  background-color: #fff2f0;
  border-color: #ff4d4f;
}

.add-model-section {
  background-color: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.add-model-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1rem;
  color: #333;
}

.add-model-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.add-model-input {
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  transition: all 0.3s;
}

.add-model-input:focus {
  border-color: #1677ff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
}

.add-model-button {
  width: 100%;
  padding: 8px 16px;
  background-color: #1677ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-model-button:hover {
  background-color: #0958d9;
}

.add-model-button:disabled {
  background-color: #d9d9d9;
  color: #bfbfbf;
  cursor: not-allowed;
}
</style> 