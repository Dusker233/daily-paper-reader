# 日报 · 2026-07-01

- 生成时间：2026-07-01 22:14:42 UTC
- 当次推荐总数：15
- 精读区：4
- 速读区：11

## 今日简报（AI）
今天汇总了15篇关于AI安全、加密网络流量分析与检索增强生成（RAG）安全防护的最新研究进展。  
重点集中在可解释的加密流量分类与RAG系统的投毒溯源与威胁防御，同时涵盖DoH/DoH3指纹识别与AI生成恶意PowerShell检测。  
建议重点关注RAG安全架构与数据投毒防护方法，并持续跟进网络流量分析可解释性技术的应用落地。

## 精读区
1. [Traffic\-CBM：一种结构可解释的加密流量分类多模态框架](/202607/01/2606.29909v1-traffic-cbm-a-structurally-interpretable-multimodal-framework-for-encrypted-traffic-classification)（8.8/10）
   摘要：本文提出Traffic\-CBM用于加密流量分类的结构化可解释多模态建模，将流量统计、时序与字节级特征组织为分层概念空间（统计、时序、包级与跨包字节概念），替代黑盒融合。实验表明其在多数据集上取得有竞争力性能与更好跨数据集稳定性，并提升结构可解释性，但带来计算开销且字节语义解释仍有限，适合关注可解释网络流量分析方向阅读。
2. [检索增强生成中的安全与隐私：面向构建可信系统的架构、威胁、防御与未来方向](/202607/01/2606.25533v1-security-and-privacy-in-retrieval-augmented-generation-architectures-threats-defenses-and-future-directions-for-building-trustworthy-systems)（8.5/10）
   摘要：本文系统综述检索增强生成（RAG）在集中式、端侧Micro\-RAG、联邦与混合架构中的安全与隐私问题，围绕检索、上下文构建与生成三阶段建立统一威胁分类，重点分析成员推断、索引推断、数据投毒、梯度泄露与提示注入等攻击，并总结差分隐私、同态加密、可信执行环境等防御手段及其隐私\-性能权衡，同时提出未来构建可信RAG系统的研究方向。
3. [大语言模型（LLM）智能体安全二元性：自安全与赋能网络安全的综合综述](/202607/01/2606.28450v1-llm-agents-security-duality-a-comprehensive-survey-of-self-security-and-empowered-cybersecurity)（8.4/10）
   摘要：本文系统综述LLM agent安全双重性：自安全与赋能网络安全两条主线，构建威胁\-缓解\-攻防全生命周期taxonomy，并总结评测与未来方向，强调安全与能力正反馈关系，适合快速把握研究全景与进入点，判断是否值得深入精读。
4. [CVE\-TTP知识图谱：连接软件漏洞与攻击行为的知识图谱](/202607/01/2606.31557v1-cve-ttp-kg-knowledge-graph-linking-software-vulnerabilities-to-attack-behaviors)（8.1/10）
   摘要：本文提出CVE\-TTP知识图谱方法，将软件漏洞（CVE）与MITRE ATT&CK战术/技术进行自动关联，通过Transformer分类与实体关系抽取构建Neo4j威胁知识图谱，并在自建数据集上取得较高性能（战术/技术识别F1达0.87/0.96级别），同时验证实体与关系抽取效果良好（关系F1接近0.99），整体用于提升漏洞情境化分析与攻击理解能力，方法完整且实验充分，值得进一步精读。

## 速读区
1. [DoHFuse：一种基于DMAGLSTM的双分支架构，用于DNS over HTTPS/3环境下的网站指纹识别](/202607/01/2606.24105v1-dohfuse-a-dual-branch-architecture-with-dmaglstm-for-website-fingerprinting-over-dns-over-https3)（7.9/10）
   摘要：本文研究DoH/3环境下网站指纹攻击可行性，构建449类真实DNS over HTTP/3流量数据集，并提出双分支DoHFuse模型（DMAG\-LSTM\+统计特征融合）捕获时序突发模式。在封闭世界达88.05%准确率，开放世界AUPRC 0.975、F1 0.951，表明现有padding难以抵御WF攻击，整体具有较高参考与阅读价值。
2. [基于Token影响归因的投毒检索语料目标答案追踪](/202607/01/2606.25721v1-tracing-target-answers-in-poisoned-retrieval-corpora-via-token-influence-attribution)（7.9/10）
   摘要：论文提出TRACE用于检测RAG语料投毒，通过对目标LLM进行token级影响归因，挖掘跨文档重复高影响token并二次验证其对预测的作用，在无需额外分类器或LLM复核情况下实现轻量检测，并能定位攻击者目标答案。实验证明在3个QA基准与6种LLM上表现出较强检测能力，值得进一步精读。
3. [AI生成的PowerShell恶意软件：实验框架与数据集](/202607/01/2606.30819v1-ai-generated-powershell-malware-an-experimental-framework-and-dataset)（7.7/10）
   摘要：本文提出用于评估大模型生成PowerShell恶意软件的实验框架，构建PSStrikes数据集与PSSandman沙箱，结合静态与动态分析比较真实与生成样本行为，发现小于10B参数开源模型即可生成高保真恶意脚本，且生成样本在行为事件层面与真实恶意软件高度一致（Jaccard中位84.5%），说明仅靠文本相似性不足以评估风险，具有较高安全研究价值，值得细读。
4. [基于机器学习的真实物联网网络入侵检测对比分析](/202607/01/2606.31594v1-comparative-analysis-of-machine-learning-based-intrusion-detection-in-realistic-iot-networks)（7.6/10）
   摘要：本文围绕物联网入侵检测问题，在Gotham2025真实化测试平台生成的数据集（78个IoT设备，MQTT/CoAP/RTSP流量）上，对随机森林、XGBoost、逻辑回归、朴素贝叶斯与深度神经网络进行系统对比评估，旨在弥补以往研究多基于旧数据或单模型的不足。实验表明随机森林表现最优，F1\-score达0.99，整体结果显示传统集成学习在该场景中仍具优势。论文方法清晰、实验直接，适合快速了解IoT IDS基准对比，但仍需进一步验证泛化能力与工程落地价值。
5. [CrypFormBench：大语言模型在密码学方案形式化分析能力的基准测试](/202607/01/2606.25561v1-crypformbench-benchmarking-formal-analysis-capability-of-large-language-models-for-cryptographic-schemes)（7.5/10）
   摘要：本文提出CrypFormBench，用于评测大语言模型对密码学方案进行形式化分析与验证的能力，通过构建基准任务与评测指标，对多类模型在安全性推理与形式化分析上的表现进行对比，旨在揭示当前模型在密码学严谨推理方面的能力边界，是否值得精读取决于对AI安全与形式化方法交叉领域兴趣。
6. [COHORT：基于仿真拓扑的攻击性回放驱动的协同编排加固方法](/202607/01/2606.30479v1-cohort-collaborative-orchestration-for-hardening-via-offensive-replay-on-emulated-topologies)（7.5/10）
   摘要：本文提出COHORT框架，用多智能体LLM在GNS3高保真网络中自动生成并实施网络加固策略，通过攻击重放、连通性回归与累积评估验证防御有效性。实验在四类攻击与多拓扑中显示46.7%策略同时阻断攻击且不影响业务，显著优于单智能体基线4.4倍，表明可自动化生成可部署防御，但仍受限于仿真与攻击类型。
7. [ForensicsTok：取证引导的Token化建模用于图像篡改定位](/202607/01/2606.24538v2-forensicstok-forensics-guided-tokenized-modeling-for-image-tampering-localization)（6.9/10）
   摘要：提出ForensicsTok，将图像篡改定位从依赖外部分割解码的MLLM流水线，改为直接自回归生成空间token序列进行mask预测，并引入Token Splatting Decoder实现codebook到二值mask的可微映射，同时通过HEF融合多尺度取证特征以补足MLLM缺乏的细粒度线索。实验覆盖6个基准任务，在多种篡改类型上显著优于现有MLLM方法，并在部分设置下接近甚至略优于传统取证专家模型，同时展现更强鲁棒性，整体值得细读。
8. [机器学习能否破解 Wi\-Fi 隐私？一项关于 MAC 地址随机化的研究](/202607/01/2606.25788v1-can-machine-learning-break-wi-fi-privacy-a-study-on-mac-address-randomization)（6.9/10）
   摘要：本文研究Wi\-Fi中MAC地址随机化的隐私有效性问题，提出结合HT能力字段的位级分解、IFAT时序特征与（模拟）RSSI空间信息构建指纹特征，并使用K\-Means/DBSCAN/OPTICS进行无监督聚类识别设备。在22台设备数据实验中，DBSCAN在特征增强后达到约89.6%识别准确率，说明现有随机化仍可被机器学习去匿名化，方法与结果均具较高参考价值，值得进一步精读特征设计与实验设置。
9. [面向网络物理系统的无模型预算攻击调度](/202607/01/2606.28642v1-model-free-budgeted-attack-scheduling-for-cyber-physical-systems)（6.9/10）
   摘要：本文研究在未知系统模型与非高斯重尾残差条件下的CPS隐蔽FDI攻击预算调度问题。提出一种无模型攻击调度器，用序列自编码器残差的经验分位数替代高斯阈值，在无需A/C/Q/R的情况下学习攻击触发策略，并证明在平稳遍历条件下攻击率几乎处处收敛至目标预算。实验在合成系统与真实重卡数据上验证方法可将预算误差控制在1–2%，显著优于模型基方法在重尾场景下最高约8.96%偏差，同时保持残差分布不变实现隐蔽性，整体具有较强实用价值，值得进一步精读。
10. [CADENZA：将自然语言意图编译为面向任务的算子DAG用于语义查询处理](/202607/01/2606.29151v1-cadenza-compiling-natural-language-intent-into-task-specific-operator-dags-for-semantic-query-processing)（6.9/10）
   摘要：本文提出CADENZA，将自然语言语义查询中的语义算子实例编译为任务特定的类型化DAG，并在质量\-时延\-成本多目标下进行联合优化。方法通过TxRA扩展、逻辑规划生成DAG、物理层多后端路由与贝叶斯优化联合调参，实现对语义算子执行路径的细粒度优化。在SemBench上显著提升质量与效率，适合关注LLM\+数据库优化的读者精读。
11. [超越无线安全：大语言模型赋能边缘网络中的隐蔽通信](/202607/01/2606.31016v1-beyond-wireless-security-covert-communications-in-large-language-model-enabled-edge-networks)（6.9/10）
   摘要：本文面向LLM赋能边缘网络中的窃听、干扰、提示注入及电磁侧信道泄露等安全问题，提出通信与计算双域隐蔽通信框架，通过联合优化传输功率与边缘CPU频率，并引入伪任务与主动混淆掩蔽计算特征，在安全约束下实现系统时延最小化。数值结果表明该方法可同时提升隐私防护能力与LLM任务执行效率，具有较高的进一步精读价值。

---
使用键盘方向键可在日报/论文之间快速切换。
