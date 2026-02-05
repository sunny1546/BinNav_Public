// 网站数据 - 通过管理后台更新于 2026/2/5 22:12:54

// 站点配置
export const siteConfig = {
  "siteName": "问安分享",
  "siteTitle": "问安-分享",
  "siteLogo": "/assets/logo.png",
  "siteDescription": "个人使用分享站",
  "icpRecord": "",
  "publicSecurityRecord": "",
  "publicSecurityRecordUrl": ""
};

export const websiteData = [];

// 分类定义 - 支持二级分类
export const categories = [
  {
    "id": "author",
    "name": "作者专栏",
    "icon": "/assets/____.png",
    "special": true,
    "subcategories": []
  },
  {
    "id": "recommended",
    "name": "常用推荐",
    "icon": "/assets/____.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300344563",
        "name": "AI学习",
        "icon": "/assets/____.png",
        "special": false
      },
      {
        "id": "category_1770300358965",
        "name": "常用AI",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1770300388191",
    "name": "资源分享",
    "icon": "/assets/tools_icon.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300419548",
        "name": "导航站",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300432138",
        "name": "分享站",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300523587",
        "name": "网盘资源",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300535971",
        "name": "书籍资源",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300556431",
        "name": "其它资源",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1751807929795",
    "name": "人工智能",
    "icon": "/assets/ai.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300581787",
        "name": "AI编程",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300599053",
        "name": "AI其它",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1770300613701",
    "name": "电脑相关",
    "icon": "/assets/tools_icon.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300624704",
        "name": "软件",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300635754",
        "name": "工具",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300645523",
        "name": "插件脚本",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300655566",
        "name": "电脑其它",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300665675",
        "name": "域名服务器",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1770300678258",
    "name": "休闲娱乐",
    "icon": "/assets/tools_icon.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300686897",
        "name": "音乐",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300697514",
        "name": "小说",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1770300707942",
    "name": "折腾学习",
    "icon": "/assets/tools_icon.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300715634",
        "name": "折腾",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300724503",
        "name": "学习",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300734553",
        "name": "其它链接",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  },
  {
    "id": "category_1770300748805",
    "name": "科学上网",
    "icon": "/assets/tools_icon.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1770300757443",
        "name": "机场",
        "icon": "/assets/tools_icon.png",
        "special": false
      },
      {
        "id": "category_1770300765705",
        "name": "黑科技",
        "icon": "/assets/tools_icon.png",
        "special": false
      }
    ]
  }
];

// 搜索引擎配置
export const searchEngines = [
  { id: "bing", name: "必应", url: "https://www.bing.com/search?q=", color: "bg-blue-600" },
  { id: "baidu", name: "百度", url: "https://www.baidu.com/s?wd=", color: "bg-red-600" },
  { id: "google", name: "谷歌", url: "https://www.google.com/search?q=", color: "bg-green-600" },
  { id: "internal", name: "站内搜索", url: "", color: "bg-purple-600" }
];

// 推荐内容配置
export const recommendations = [
  {
    id: 1,
    title: "阿里云",
    description: "点击领取2000元限量云产品优惠券",
    url: "https://aliyun.com",
    type: "sponsor",
    color: "from-blue-50 to-blue-100"
  },
  {
    id: 2,
    title: "设计资源",
    description: "高质量设计素材网站推荐",
    url: "#design_resources",
    type: "internal",
    color: "from-green-50 to-green-100"
  }
];

// 热门标签
export const popularTags = [
  "设计工具", "免费素材", "UI设计", "前端开发", "图标库", "配色方案",
  "设计灵感", "原型工具", "代码托管", "学习平台", "社区论坛", "创业资讯"
];

// 网站统计信息
export const siteStats = {
  totalSites: websiteData.length,
  totalCategories: categories.length,
  totalTags: [...new Set(websiteData.flatMap(site => site.tags || []))].length,
  lastUpdated: "2026-02-05"
};
