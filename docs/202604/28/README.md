# 日报 · 2026-04-28

- 生成时间：2026-04-28 21:05:44 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天共阅读了17篇文章，其中精读6篇，速读11篇。重点关注了LLM代理在网络安全中的应用，尤其是在发现CVEs和安全操作中的威胁猎捕。建议继续关注5G网络中的入侵检测和LLM在安全防御中的新发展。

## 精读区
1. [TitanCA：从协调大语言模型代理发现100多个CVE中的经验教训](/202604/28/2604.17860v1-titanca-lessons-from-orchestrating-llm-agents-to-discover-100-cves)（8.5/10）
   摘要：TitanCA 项目提出了一种基于多 LLM 代理的分层漏洞发现管线，用于自动识别开源软件中的安全漏洞。通过四个模块（匹配、过滤、检查、适配），系统实现高精度漏洞检测。应用于 127,000 个 GitHub 仓库，发现 203 个零日漏洞，并发布 118 个 CVE，显示该方法相比传统 SAST 工具有显著优势，值得进一步精读以了解 LLM 编排与漏洞检测实践。
2. [网络防御基准：面向大规模语言模型（LLM）在安全运营中的威胁狩猎评估](/202604/28/2604.19533v1-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.5/10）
   摘要：本文提出了Cyber Defense Benchmark，用于评估大语言模型\(LLM\)在安全运营中心\(SOC\)威胁狩猎任务中的能力。通过将106个真实攻击程序封装为Gymnasium强化学习环境，模型需要在未经引导的Windows日志数据库中识别恶意事件。实验结果显示，即使最强模型Claude Opus 4.6也仅平均标记3.8%的恶意事件，所有模型均未达到50%召回的最低操作标准，表明当前LLM在开放式证据驱动的威胁狩猎上表现不足。论文值得关注LLM在实战SOC任务中的局限性。
3. [动态网络靶场](/202604/28/2604.24184v1-dynamic-cyber-ranges)（8.5/10）
   摘要：本文提出了一种动态网络攻防测试环境——动态网络靶场（Dynamic Cyber Ranges），通过LLM驱动的防御代理在攻击过程中实时应对、监控和强化基础设施，从而减少了攻击者的成功率。实验表明，防御代理在多个场景中能显著降低攻击成功率，且在不同的基础设施上，攻击者成功率从0%到55%不等。研究提出的方法有效延伸了AI在网络安全领域的评估能力，对于传统的静态网络靶场设计提出了挑战。若您对动态防御策略感兴趣，继续阅读值得探讨其实验细节与防御机制。
4. [DP\-FlogTinyLLM：使用Tiny LLM进行差分隐私联邦日志异常检测](/202604/28/2604.19118v1-dp-flogtinyllm-differentially-private-federated-log-anomaly-detection-using-tiny-llms)（8.2/10）
   摘要：本研究提出了一种名为DP\-FlogTinyLLM的框架，结合了差分隐私和联邦学习，用于高效地检测分布式系统中的日志异常。该方法通过使用Tiny LLM（小型语言模型）并应用低秩适配（LoRA）技术来减少计算开销，并确保数据隐私。实验证明，该方法在保护隐私的同时，能够与传统的集中式方法相媲美，特别在精度和F1分数方面取得了显著提高。值得继续精读，尤其是对于隐私保护与计算效率的权衡感兴趣的读者。
5. [大语言模型运行时异常检测的分层收敛指纹](/202604/28/2604.24542v1-layerwise-convergence-fingerprints-for-runtime-misbehavior-detection-in-large-language-models)（8.2/10）
   摘要：本文提出了层级收敛指纹（LCF）作为一种无调优、通用的运行时安全监控方法，旨在检测大型语言模型（LLM）的运行时不良行为，如后门、越狱和提示注入。LCF通过计算每层隐藏状态的马氏距离并进行聚合，能够在无参考模型、无触发知识和无需再训练的情况下，成功识别多种攻击方式。实验表明，LCF能够显著降低后门攻击成功率，同时检测大部分越狱攻击和提示注入，且计算开销极小。该方法适用于部署在云端或设备上的LLM。若关注该领域的运行时安全性，值得深入阅读。
6. [LayerTracer：面向任意大型语言模型架构的任务粒子与易损层联合分析框架](/202604/28/2604.20556v1-layertracer-a-joint-task-particle-and-vulnerable-layer-analysis-framework-for-arbitrary-large-language-model-architectures)（8.0/10）
   摘要：本论文提出了一个名为LayerTracer的框架，旨在分析大规模语言模型（LLM）架构的任务粒子和脆弱层，提供与架构无关的层级行为分析。方法通过提取隐藏状态并映射到词汇概率分布，结合任务粒子定位和脆弱层定量分析，帮助设计和优化混合架构模型。实验表明，LayerTracer可以准确定位任务有效层和模型的鲁棒性瓶颈。此研究对LLM架构设计有重要指导意义，适合有架构设计需求的研究人员继续精读。

## 速读区
1. [网络防御基准：针对大语言模型在安全运营中的主动威胁狩猎评估](/202604/28/2604.19533v3-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.0/10）
   摘要：本文介绍了‘Cyber Defense Benchmark’，一个评估大型语言模型（LLM）在安全运营中心（SOC）威胁狩猎任务中表现的基准。研究通过使用真实的Windows事件日志，评估LLM是否能独立推理并发现恶意事件的时间戳。实验发现，尽管Claude Opus 4.6是最强的模型，但其表现仍不理想，未能在所有任务中达到50%以上的召回率，显示出当前LLM在无引导的、基于证据的威胁狩猎任务中的不足。这表明，LLM仍不适合进行开放式的威胁狩猎任务，尽管在预设问题解答上有较好表现。
2. [网络防御基准：针对大语言模型在安全运营中的主动威胁狩猎评估](/202604/28/2604.19533v2-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（7.9/10）
   摘要：本文提出了Cyber Defense Benchmark，用于评估大型语言模型\(LLM\)在安全运营中心\(SOC\)中执行无引导威胁狩猎任务的能力。研究使用106个真实攻击流程构建强化学习环境，要求模型从原始Windows日志中发现恶意事件时间戳。实验结果显示，所有评估模型均表现不佳，最佳模型平均覆盖率仅为0.55，未能达到最低运营要求，提示当前LLM在开放式证据驱动的威胁狩猎中能力有限，值得关注其方法和评测设计。
3. [ExAI5G：一种基于逻辑的可解释人工智能框架用于5G网络中的入侵检测](/202604/28/2604.18052v1-exai5g-a-logic-based-explainable-ai-framework-for-intrusion-detection-in-5g-networks)（7.8/10）
   摘要：ExAI5G 提出了一个结合 Transformer 深度学习模型与基于逻辑的可解释 AI \(XAI\) 技术的框架，用于 5G 网络入侵检测。该框架通过提取特征重要性并利用决策树提取逻辑规则，使深度学习模型更加透明。实验结果显示，该系统在 5G IoT 入侵数据集上取得了 99.9% 的准确率和 0.854 的宏观 F1 得分，且提取的 16 条逻辑规则具有 99.7% 的忠实度。此框架突出了性能与可解释性之间的平衡，值得精读以了解其在 5G 网络安全中的应用潜力。
4. [大规模语言模型的网络边缘推理：原理、技术与机遇](/202604/28/2604.22906v1-network-edge-inference-for-large-language-models-principles-techniques-and-opportunities)（7.8/10）
   摘要：本论文探讨了在网络边缘环境中部署大规模语言模型（LLMs）的挑战与机遇，重点讨论了边缘推理的架构、模型优化和资源管理技术。通过总结现有技术的进展，论文提出了一些前沿方法，旨在解决LLMs部署时在内存、计算和带宽等方面的瓶颈。论文特别强调了云推理方案的局限性，并探讨了将LLMs推向边缘设备的可行性。该论文对于想了解边缘计算环境中大规模语言模型部署的研究人员具有较高参考价值。
5. [AsmRAG：通过检索功能相似的汇编代码进行大语言模型驱动的恶意软件检测](/202604/28/2604.23196v1-asmrag-llm-driven-malware-detection-by-retrieving-functionally-similar-assembly-code)（7.8/10）
   摘要：AsmRAG 提出了一种基于大语言模型（LLM）的汇编代码语义检索方法，用于恶意软件检测，旨在解决传统深度学习模型可解释性差、易受语法混淆攻击的问题。通过构建函数级语义嵌入和密度加权锚点选择机制，系统在 4 万余个二进制文件上实现了 96% 的检测 F1 分数和 95% 的家族归属 F1 分数，提供透明可验证的取证证据，值得关注其函数级语义检索和解释能力。
6. [基于RLWE密码系统的加密视觉反馈控制](/202604/28/2604.21410v1-encrypted-visual-feedback-control-using-rlwe-based-cryptosystem)（7.6/10）
   摘要：本文提出了一种基于RLWE加密的视觉反馈控制算法，旨在通过加密图像进行特征提取和控制输入计算，从而保护视觉数据的隐私。该算法利用RLWE加密中的消息打包技术，减少了计算成本，并通过数值仿真验证了其可行性。若论文能够进一步分析加密参数与控制性能之间的平衡，可能会带来更广泛的应用前景。值得继续细读。
7. [RAVEN：面向用户代码与二进制程序内存破坏分析的检索增强型漏洞探索网络](/202604/28/2604.17948v1-raven-retrieval-augmented-vulnerability-exploration-network-for-memory-corruption-analysis-in-user-code-and-binary-programs)（7.5/10）
   摘要：本论文提出RAVEN框架，通过多代理系统结合检索增强生成（RAG）技术，自动生成类似Google Project Zero风格的漏洞分析报告。方法包括漏洞探索、知识检索、影响评估和报告生成四个模块，并通过LLM Judge评估报告质量。实验在NIST\-SARD数据集105个样例上进行，平均报告质量得分为54.21%，显示了在自动化漏洞文档生成上的可行性与潜力，值得对方法和评估细节进行深入阅读。
8. [通过多源动态Logit融合实现低资源语言的高效适配](/202604/28/2604.18106v1-efficient-low-resource-language-adaptation-via-multi-source-dynamic-logit-fusion)（7.5/10）
   摘要：本研究针对低资源语言（LRL）下大语言模型（LLM）适应困难的问题，提出 TRI MIX 框架，通过在推理时动态融合小模型的语言能力、HRL任务能力和大模型的规模效应，实现无需任务标注的高效适应。实验显示 TRI MIX 在八种低资源语言和多模型组合上均优于单模型基线和 Proxy Tuning，尤其强调小模型的优先权重，对研究低资源语言适应具有较高参考价值。
9. [基于大语言模型推理的 Node.js 包污点式漏洞检测与确认](/202604/28/2604.20179v1-taint-style-vulnerability-detection-and-confirmation-for-nodejs-packages-using-llm-agent-reasoning)（6.8/10）
   摘要：本文提出了一种基于大语言模型（LLM）的多阶段代理框架LLMVD.js，用于Node.js包中的污点风格漏洞检测和确认。与传统的静态/动态分析工具相比，LLMVD.js在不依赖专用分析引擎的情况下，能够有效地检测并确认漏洞，尤其在高效性和准确性方面表现突出。实验表明，该方法能够确认公共基准数据集84%的漏洞，并在未公开漏洞信息的260个新发布的包中发现了36个漏洞。值得继续精读，特别是方法部分和实验结果部分。
10. [使用预测掩蔽图自编码器预测单个网络流量变化](/202604/28/2604.20483v2-forecasting-individual-netflows-using-a-predictive-masked-graph-autoencoder)（6.8/10）
   摘要：本文提出了一种基于图神经网络的预测掩码自编码器（Predictive Masked Graph Autoencoder），用于对单条网络流量（NetFlow）进行精细预测。研究通过构建异构图，捕捉IP、端口及连接特征的演变，实现单步流量预测。实验显示，该方法在识别端口和IP方面优于传统序列预测模型，同时在特征重建上表现竞争力。研究表明GNN在每流量预测中具有明显结构优势，值得关注精读网络流量预测应用。
11. [一种云原生架构用于人类主导的LLM辅助OpenSearch在调查环境中的应用](/202604/28/2604.21125v1-a-cloud-native-architecture-for-human-in-control-llm-assisted-opensearch-in-investigative-settings)（6.8/10）
   摘要：本研究提出了一种面向调查环境的云原生架构，利用大语言模型（LLM）辅助的OpenSearch实现自然语言查询与搜索逻辑的桥接。方法通过Human\-in\-Control工作流将自然语言查询转换为有效的OpenSearch DSL表达式，解决了传统查询语言与调查人员自然语言意图之间的语义差距。系统原型展示了该架构的技术可行性，并通过Enron邮件数据集进行验证。对于有需要在复杂证据中快速准确检索的调查人员，本研究提供了一个创新的工具链，值得进一步探索与验证。

---
使用键盘方向键可在日报/论文之间快速切换。
