<div class="dpr-home-notice-card">
  <h3 class="dpr-home-notice-title">🚀 Start Here</h3>
  <ul class="dpr-home-notice-list">
    <li><a href="#/tutorial/README">使用教程</a></li>
  </ul>
</div>

## 每次日报
- 最新运行日期：2026-04-19
- 运行时间：2026-04-19 19:46:40 UTC
- 运行状态：成功
- 本次总论文数：14
- 精读区：3
- 速读区：11

### 今日简报（AI）
今日完成 14 篇论文阅读，涵盖加密推理、隐私保护与多模态大模型应用。  
重点关注加密数据上的高效 Transformer 推理和无线网络下 LLM 微调的隐私-通信-存储平衡。  
建议关注隐私保护工具和多模态模型进展，提升日常应用安全与效率感知。
- 详情：[/202604/19/README](/202604/19/README)

### 精读区论文标签
1. [EncFormer: Secure and Efficient Transformer Inference over Encrypted Data](/202604/19/2604.09975v1-encformer-secure-and-efficient-transformer-inference-over-encrypted-data)  
   标签：评分：8.1/10、query:q9
   摘要：EncFormer提出了一种私有Transformer推理框架，结合了全同态加密（FHE）和安全多方计算（MPC），旨在通过高效的加密核和减少转换负载来解决现有系统的低效问题。其创新的阶段兼容模式（SCP）提高了加密核的效能，减少了重打包和转换成本，并通过设计有效的MPC协议减少了通信开销。实验结果表明，EncFormer相较于现有系统在通信和延迟上有显著优化，且在多个任务中保持接近明文精度。该研究提出了如何在私有推理任务中更高效地使用FHE和MPC，值得进一步精读。
   evidence：涉及加密数据上的安全推理，与LLM和网络安全相关
2. [Three Birds, One Stone: Solving the Communication-Memory-Privacy Trilemma in LLM Fine-tuning Over Wireless Networks with Zeroth-Order Optimization](/202604/19/2604.12401v1-three-birds-one-stone-solving-the-communication-memory-privacy-trilemma-in-llm-fine-tuning-over-wireless-networks-with-zeroth-order-optimization)  
   标签：评分：8.1/10、query:profile-1
   摘要：本文提出 pAirZero 框架，通过将 Zeroth-Order 优化与无线 OTA 计算结合，实现边缘设备上 LLM 的高效私有微调。方法显著降低通信量至比特级，内存需求降至推理级，同时利用信道噪声和人工噪声嵌入差分隐私保护。实验表明在 OPT-125M 上性能接近非私有基线，通信和内存开销远低于传统方法，值得继续精读以了解其在边缘 LLM 微调中的可行性与创新设计。
   evidence：LLM在无线网络中的微调解决内存、通信和隐私问题
3. [MLDAS: Machine Learning Dynamic Algorithm Selection for Software-Defined Networking Security](/202604/19/2604.14957v1-mldas-machine-learning-dynamic-algorithm-selection-for-software-defined-networking-security)  
   标签：评分：8.0/10、query:q3
   摘要：本文提出了一种结合机器学习与软件定义网络(SDN)的动态算法选择框架，用于提升网络入侵检测的安全性。通过实时分析网络流量特征，自动选择最合适的机器学习算法，实现对DDoS攻击和其他异常流量的高效检测。实验结果显示该方法在仿真和真实流量下均具有高准确性和性能，值得进一步深入阅读以了解方法细节和实际应用可行性。
   evidence：关注网络安全和机器学习算法用于入侵检测

### 速读区论文标签
1. [LLM-Redactor: An Empirical Evaluation of Eight Techniques for Privacy-Preserving LLM Requests](/202604/19/2604.12064v1-llm-redactor-an-empirical-evaluation-of-eight-techniques-for-privacy-preserving-llm-requests)  
   标签：评分：7.9/10、query:q9
   摘要：本研究系统评估了八种针对大语言模型请求的隐私保护技术，包括本地推理、内容脱敏、语义改写、差分隐私噪声等，并实现了可与OpenAI兼容的开源中间件。实验基于1,300条标注样本的敏感信息泄露基准，发现没有单一技术完全优于其他方法，组合策略A+B+C在PII保护上效果最佳，零精确泄露，表明对于开发者和企业场景值得参考和深入阅读。
   evidence：LLM应用的隐私技术
2. [Towards Automated Pentesting with Large Language Models](/202604/19/2604.11772v1-towards-automated-pentesting-with-large-language-models)  
   标签：评分：7.8/10、query:q9
   摘要：论文提出RedShell框架，利用本地微调的大语言模型自动生成针对Windows漏洞的恶意PowerShell代码，用于辅助渗透测试。方法上通过扩展恶意脚本数据集并进行精调，同时强调隐私保护与低硬件需求。实验显示生成代码在语法有效性（>90%）、语义相似度（>50%）及执行可靠性上优于对比方法。整体证明LLM可在受控环境中有效提升渗透测试自动化程度，具有较高应用潜力，值得关注实现细节与评估设计。
   evidence：专注于LLMs在网络安全和渗透测试中的应用
3. [Empowering Video Translation using Multimodal Large Language Models](/202604/19/2604.11283v1-empowering-video-translation-using-multimodal-large-language-models)  
   标签：评分：7.6/10、query:q6
   摘要：本研究探讨了多模态大语言模型（MLLMs）在视频翻译中的应用，提出了一种统一的视频翻译框架，解决了传统视频翻译流水线存在的语音识别、机器翻译、文本到语音和唇同步等单独处理的问题。研究提供了三角色的分类方法：语义推理者、表现性表演者和视觉合成器，分别对应视频理解、多模态信息融合、表现性语音生成和高保真唇同步等任务。通过多模态联合建模，MLLMs 展现了更强的零-shot 处理能力及多语音场景的鲁棒性。值得进一步精读，尤其是对这些方法的系统化框架与挑战进行深入分析。
   evidence：聚焦于多模态语言模型用于视频翻译，涉及LLM与视频识别的结合
4. [AdversarialCoT: Single-Document Retrieval Poisoning for LLM Reasoning](/202604/19/2604.12201v1-adversarialcot-single-document-retrieval-poisoning-for-llm-reasoning)  
   标签：评分：7.6/10、query:q9
   摘要：本论文提出了 AdversarialCoT 方法，研究在检索增强生成（RAG）系统中通过单文档注入攻击影响大语言模型（LLM）推理的可行性。作者通过模拟目标模型的推理链条，迭代优化单个对抗文档，使其在检索过程中被自然采纳并削弱模型推理准确性。实验表明，即便只有一篇对抗文档，也能显著降低 LLM 推理性能，揭示了 RAG 系统的潜在安全风险，值得对单文档攻击策略及防御机制进一步深入阅读。
   evidence：检索增强生成中的知识库中毒攻击
5. [Structure-Grounded Knowledge Retrieval via Code Dependencies for Multi-Step Data Reasoning](/202604/19/2604.10516v1-structure-grounded-knowledge-retrieval-via-code-dependencies-for-multi-step-data-reasoning)  
   标签：评分：7.5/10、query:profile-1
   摘要：本论文提出了Structure-Grounded Knowledge Retrieval (SGKR) 框架，旨在提升大语言模型在多步骤数据分析任务中的知识检索准确性。通过将领域知识与函数调用依赖图结合，SGKR能够根据输入输出语义标签构建任务相关子图，为代码生成提供结构化上下文。实验表明，该方法在多步数据分析基准上优于无检索及基于相似性的检索方法，显著提高了程序正确性，值得深入研究其方法设计与实验结果。
   evidence：用于结构化领域任务的LLM知识检索
6. [SEED: A Large-Scale Benchmark for Provenance Tracing in Sequential Deepfake Facial Edits](/202604/19/2604.10522v1-seed-a-large-scale-benchmark-for-provenance-tracing-in-sequential-deepfake-facial-edits)  
   标签：评分：7.5/10、query:q6
   摘要：本论文提出 SEED，大规模顺序深度伪造面部编辑溯源基准，覆盖九万多张图像和多步编辑序列，提供编辑顺序、文本指令和操作掩码等精细标注。研究发现仅基于空间特征难以捕捉累积扩散伪造痕迹，提出频域感知 Transformer（FAITH）提升多步编辑顺序恢复能力。该基准有助于系统研究图像溯源与伪造检测，值得在 AI 图像安全与法务方向进一步精读。
   evidence：深度伪造视频溯源分析
7. [From Relevance to Authority: Authority-aware Generative Retrieval in Web Search Engines](/202604/19/2604.13468v1-from-relevance-to-authority-authority-aware-generative-retrieval-in-web-search-engines)  
   标签：评分：6.9/10、query:q9
   摘要：论文针对生成式检索（GenIR）仅关注相关性而忽视信息权威性的问题，提出AuthGR框架，将“权威性”显式纳入检索目标。方法通过多模态权威评分（结合文本与页面视觉信号）、三阶段训练（CPT+SFT+GRPO强化偏好）以及与传统排序器融合的混合部署实现。实验显示3B模型即可达到14B基线效果，并在真实搜索平台A/B测试和人工评测中提升用户参与度与可靠性。问题重要、工程落地充分，值得精读。
   evidence：聚焦生成检索，间接与LLM和网络安全相关
8. [Mosaic: Cross-Modal Clustering for Efficient Video Understanding](/202604/19/2604.10060v1-mosaic-cross-modal-clustering-for-efficient-video-understanding)  
   标签：评分：6.8/10、query:q6
   摘要：本论文提出 MOSAIC，一种面向流式长视频理解的跨模态聚类大视觉语言模型推理系统，旨在解决视频帧持续到达时 KVCache 扩张导致的计算和内存开销问题。通过将 KVCache 从逐 token 管理转为跨模态聚类管理，MOSAIC 实现了高效缓存维护与检索，实验显示可在延迟和 GPU 内存使用上显著优于现有方法，最高加速达 1.38 倍，值得关注和深入阅读。
   evidence：LLM跨模态视频理解
9. [Neural Stringology Based Cryptanalysis of EChaCha20](/202604/19/2604.13289v1-neural-stringology-based-cryptanalysis-of-echacha20)  
   标签：评分：6.8/10、query:q4
   摘要：本文提出了一种基于神经字符串学（Neural Stringology）的密码分析框架，对EChaCha20流密码的密钥流进行结构性分析。研究通过结合传统字符串模式特征提取与神经网络学习，发现了常规统计测试可能无法捕捉的局部结构特征。实验结果显示，在受控条件下，NSC框架能够识别密钥流中的可区分结构，为评估ARX流密码的结构稳健性提供了新的辅助方法。值得进一步精读了解方法细节和实验验证。
   evidence：用于加密流密码分析的机器学习技术
10. [Don't Retrieve, Navigate: Distilling Enterprise Knowledge into Navigable Agent Skills for QA and RAG](/202604/19/2604.14572v1-dont-retrieve-navigate-distilling-enterprise-knowledge-into-navigable-agent-skills-for-qa-and-rag)  
   标签：评分：6.8/10、query:q3
   摘要：本文针对企业知识库问答中传统RAG方法缺乏全局结构感知的问题，提出Corpus2Skill框架，将文档语料编译成可导航的层级技能树，让LLM代理在服务端主动浏览、回溯和组合证据。实验显示，在WixQA企业客服基准上，Corpus2Skill在所有指标上优于密集检索、RAPTOR和多轮Agentic RAG，显著提升答案质量并减少嵌入索引依赖，值得深入研究其导航式知识整合机制。
   evidence：LLM代理浏览文档语料库以提取知识
11. [Latent-Condensed Transformer for Efficient Long Context Modeling](/202604/19/2604.12452v1-latent-condensed-transformer-for-efficient-long-context-modeling)  
   标签：评分：6.8/10、query:q3
   摘要：本论文提出了Latent-Condensed Attention (LCA)，一种高效的注意力机制，旨在解决大语言模型在长上下文建模中的两个挑战：关键值缓存增长和自注意力的二次复杂性。LCA通过在MLA的潜在空间内压缩上下文来减小计算和缓存的开销，采用语义向量加权池化与位置锚点选择相结合的策略，有效提升了长上下文的处理效率。实验表明，LCA在128K上下文长度下比传统方法提高了2.5倍的预填充速度，并减少了90%的KV缓存，同时保持了竞争力的性能。若目标是提高长上下文效率，值得进一步细读。
   evidence：用于高效上下文建模的潜空间LLM注意力


<div class="dpr-home-promo-card">
  <h3 class="dpr-home-promo-title">💬 社区与支持</h3>
  <ul class="dpr-home-promo-list">
    <li>欢迎 Star / Fork / Issue / PR</li>
    <li>QQ群：583867967（欢迎交流，已有：1151人）</li>
  </ul>
</div>

<!--dpr-seed-papers:start-->
## Seed Papers
- [Latest: Wan et al.   2025   CATO End to end optimization of ML based traffic analysis pipelines](/seed-papers/1776601904977/index)
<!--dpr-seed-papers:end-->
