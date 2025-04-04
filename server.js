const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// 启用CORS和JSON解析
app.use(cors());
app.use(bodyParser.json());

// 模拟的工具列表
const tools = [
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'get_news',
    description: '获取最新新闻',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '新闻类别，如：科技、体育、财经等'
        }
      }
    }
  }
];

// 获取工具列表
app.get('/tools', (req, res) => {
  res.json({ tools });
});

// 处理聊天请求
app.post('/chat', (req, res) => {
  const { query, provider = 'openai' } = req.body;
  
  // 模拟LLM响应
  setTimeout(() => {
    // 根据不同的模型提供商返回不同格式的响应
    let responseMessage = `这是对"${query}"的模拟响应。在实际应用中，这里会返回来自${provider === 'openai' ? 'OpenAI' : 'Claude'}的实际回复。`;
    
    if (provider === 'openai') {
      responseMessage += ' [使用OpenAI格式]';
    } else {
      responseMessage += ' [使用Anthropic格式]';
    }
    
    res.json({
      response: responseMessage
    });
  }, 1000); // 模拟网络延迟
});

// 处理天气工具调用
app.post('/tools/get_weather', (req, res) => {
  const { city } = req.body;
  
  if (!city) {
    return res.status(400).json({ error: '缺少城市参数' });
  }
  
  // 模拟天气数据
  const weatherData = {
    city,
    temperature: Math.floor(Math.random() * 30) + 5,
    condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
    humidity: Math.floor(Math.random() * 60) + 30,
    wind: Math.floor(Math.random() * 30) + 5
  };
  
  res.json({ result: weatherData });
});

// 处理新闻工具调用
app.post('/tools/get_news', (req, res) => {
  const { category = '综合' } = req.body;
  
  // 模拟新闻数据
  const newsItems = [
    `${category}新闻1: 这是一条模拟的${category}新闻`,
    `${category}新闻2: 这是另一条模拟的${category}新闻`,
    `${category}新闻3: 这是第三条模拟的${category}新闻`
  ];
  
  res.json({ result: newsItems });
});

// 启动服务器
app.listen(port, () => {
  console.log(`MCP服务端运行在 http://localhost:${port}`);
}); 