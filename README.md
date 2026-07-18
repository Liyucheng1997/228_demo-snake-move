# 🐍 蛇的三维建模 · Snake Anatomy & Behavior

基于 **Three.js** 的交互式蛇类三维模型，用于观察和学习蛇的运动方式、身体结构与捕食行为。纯前端单文件实现，打开即用。

![Three.js](https://img.shields.io/badge/Three.js-r160-black) ![version](https://img.shields.io/badge/version-1.0-green) ![license](https://img.shields.io/badge/license-MIT-blue)

## ✨ 功能

程序化生成的一条精细蛇（180 节脊柱 × 18 面可变形管网格 + 真实蛇皮纹理与凹凸贴图 + 环境反射光泽），配中文生物学讲解面板。

- **运动方式 Locomotion**
  - 蜿蜒（Lateral Undulation）— S 波从头传向尾
  - 侧进（Sidewinding）— 沙漠响尾蛇式，身体分段腾空
  - 直行蠕动（Rectilinear）— 腹鳞履带式推进
  - 静止 / 可调速度、波幅、波数
- **身体结构 Structure**（三种透视视图）
  - 外观鳞片
  - 骨骼（脊椎 + 成对肋骨 + 头骨，实时跟随身体弯曲）
  - 内脏（心、右肺特长、肝、胃、肠、肾、泄殖腔，按蛇的前后拉长/左右错位排列）
- **吐信子 Tongue Flicking** — 分叉舌头采样 + 信息素粒子，讲解犁鼻器（Jacobson's organ）立体嗅觉
- **捕猎与吞咽消化 Predation & Digestion** — 潜行定位 → S 形蓄力 → 突袭咬住 → 下颚脱位吞咽 → 食团在体内蠕动消化的完整链条

## 🚀 使用

直接用现代浏览器（Chrome / Edge / Firefox）打开 `index.html` 即可。

> 首次打开需要联网，Three.js 通过 CDN（unpkg）加载。

操作：拖拽旋转 · 滚轮缩放 · 右键平移。左侧面板切换模式，切到「骨骼 / 内脏」可透视蛇的内部构造。

## 🛠️ 技术

- [Three.js](https://threejs.org/) r160（ES Modules + importmap）
- `MeshPhysicalMaterial` 清漆/绒感材质 + `RoomEnvironment` 环境反射
- Canvas 程序化生成蛇皮色彩贴图与鳞片凹凸贴图
- 「跟随头部轨迹」（follow-the-leader）运动学 + 平行传输标架构建可变形管几何体

## 📄 License

MIT
