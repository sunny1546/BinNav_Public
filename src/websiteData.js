// 网站数据 - 通过管理后台更新于 2026/2/5 22:03:11

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
    "icon": "/assets/star.png",
    "special": false,
    "subcategories": []
  },
  {
    "id": "category_1751807929795",
    "name": "AI平台",
    "icon": "/assets/ai.png",
    "special": false,
    "subcategories": [
      {
        "id": "category_1751811714830",
        "name": "AI Chat",
        "icon": "/assets/Chat-2--Streamline-Kameleon__1_.png",
        "special": false,
        "subcategories": []
      },
      {
        "id": "category_1751811752885",
        "name": "AI Code",
        "icon": "/assets/Browser-Code.png",
        "special": false,
        "subcategories": []
      }
    ]
  },
  {
    "id": "dev_tools",
    "name": "开发工具",
    "icon": "/assets/Xcode--Streamline-Svg-Logos.png",
    "special": false,
    "subcategories": []
  },
  {
    "id": "friend_links",
    "name": "友情链接",
    "icon": "/assets/link.png",
    "special": false,
    "subcategories": []
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
