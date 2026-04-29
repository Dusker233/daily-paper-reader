# 日报 · 2026-04-29

- 生成时间：2026-04-29 20:56:21 UTC
- 当次推荐总数：16
- 精读区：5
- 速读区：11

## 今日简报（AI）
1\) 今日共审阅了16篇论文，其中包括5篇精读和11篇速读。
2\) 精读推荐关注《Cyber Defense Benchmark: Agentic Threat Hunting Evaluation for LLMs in SecOps》和《DP\-FlogTinyLLM: Differentially private federated log anomaly detection using Tiny LLMs》。
3\) 下步建议继续关注LLM在安全领域的应用，特别是对敏感数据的保护与风险评估。

## 精读区
1. [网络防御基准：大语言模型在安全运营中的威胁狩猎评估](/202604/29/2604.19533v2-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.6/10）
   摘要：本文提出Cyber Defense Benchmark，旨在评估大型语言模型\(LLM\)在安全运营中心\(SOC\)的威胁狩猎任务中的能力。通过将106条真实攻击流程封装为Gymnasium环境，要求模型在无引导问题下从大规模原始Windows日志中识别恶意事件时间戳。实验表明，即使是最强模型Claude Opus 4.6，其覆盖得分也仅为0.55，远未达到实际部署的最低标准。结果提示当前LLM在开放式、证据驱动的威胁狩猎中表现不足，但该基准为后续研究提供了明确量化参考，值得精读。
2. [DP\-FlogTinyLLM：基于微型LLM的差分隐私联邦日志异常检测](/202604/29/2604.19118v1-dp-flogtinyllm-differentially-private-federated-log-anomaly-detection-using-tiny-llms)（8.3/10）
   摘要：本文提出了一种名为DP\-FlogTinyLLM的隐私保护联邦学习框架，旨在解决分布式系统日志中的异常检测问题。该方法结合了低秩自适应技术（LoRA）与差分隐私，确保在不共享原始数据的前提下进行高效训练。实验证明，DP\-FlogTinyLLM在准确率和F1分数上优于现有的联邦学习基准，并在Thunderbird数据集上表现出色。适用于需要隐私保护且计算资源有限的环境。整体方法对于隐私和异构数据问题提供了有效的解决方案，值得进一步关注。
3. [SDNGuardStack：一种可解释的集成学习框架用于软件定义网络的高精度入侵检测](/202604/29/2604.20934v1-sdnguardstack-an-explainable-ensemble-learning-framework-for-high-accuracy-intrusion-detection-in-software-defined-networks)（8.0/10）
   摘要：该研究提出了SDNGuardStack，一种基于集成学习的可解释性入侵检测系统，专为软件定义网络（SDN）设计。通过使用InSDN数据集，研究展示了该方法在提高准确率和计算效率上的潜力，同时结合了SHAP等可解释AI方法来增加模型的透明性。实验结果表明，SDNGuardStack在准确性（99.98%）和Cohen Kappa（0.9998）方面超过了其他模型，并具有较好的可解释性。若关注高准确度与可执行性，本文值得细读。
4. [AsmRAG：通过检索功能相似汇编代码的LLM驱动恶意软件检测](/202604/29/2604.23196v1-asmrag-llm-driven-malware-detection-by-retrieving-functionally-similar-assembly-code)（8.0/10）
   摘要：本文提出 AsmRAG，一种基于大语言模型的汇编代码语义检索框架，用于恶意软件检测和家族归属分析。通过将函数级汇编代码转为语义嵌入，并使用密度加权锚点选择机制，系统可对抗代码混淆和变形，提供可解释的检测证据。在 40k 二进制样本测试中，检测 F1 值达 96%，家族归属 F1 值达 95%，显示该方法在对抗传统全局统计模型退化时依然稳健，值得进一步精读。
5. [在加密数据上训练机器学习模型：利用同态加密的隐私保护框架](/202604/29/2604.23245v1-training-machine-learning-models-on-encrypted-data-a-privacy-preserving-framework-using-homomorphic-encryption)（8.0/10）
   摘要：本文提出了一种基于同态加密（Homomorphic Encryption）的隐私保护机器学习框架，旨在在不解密数据的情况下训练模型。通过使用CKKS方案实现近似实数运算，论文验证了KNN、线性回归和简单MLP模型在加密数据上的训练可行性，并展示了性能可与明文训练模型相当。结果表明，该方法在保障数据隐私的同时具有实际应用潜力，值得进一步关注具体实现与性能评估。

## 速读区
1. [网络防御基准：面向 SecOps 的 LLM 主动威胁狩猎评估](/202604/29/2604.19533v3-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（7.9/10）
   摘要：This paper introduces the Cyber Defense Benchmark, a novel evaluation tool for assessing the performance of large language models \(LLMs\) in agentic threat hunting within Security Operations Centers \(SOCs\). It challenges LLMs with raw Windows event logs, requiring the identification of malicious event timestamps without any guided queries. Despite testing top models like Claude Opus 4.7 and GPT\-5, the results reveal poor performance, with none achieving a passing score of ≥50% recall across all ATT&CK tactics. The findings suggest that current LLMs are insufficient for unsupervised, evidence\-driven threat hunting, emphasizing the need for further model advancements。
2. [代理是否梦想根Shell？大规模语言模型代理在CTF挑战中的部分得分评估](/202604/29/2604.19354v1-do-agents-dream-of-root-shells-partial-credit-evaluation-of-llm-agents-in-capture-the-flag-challenges)（7.8/10）
   摘要：本文评估了大语言模型\(LLM\)代理在捕旗\(CTF\)挑战中的表现，提出了DeepRed，一个开源基准工具，通过部分积分评分方法评估代理在虚拟环境中的表现。研究发现，尽管LLM代理在一些常见挑战中有一定表现，但在复杂、需要长期适应和非标准发现的任务中表现较弱。实验表明，当前LLM代理的能力有限，平均仅完成35%的检查点，未能全面解决挑战。该研究为未来LLM在安全任务中的应用提供了洞见，值得继续关注。
3. [CyberCertBench：评估大型语言模型在网络安全认证知识中的表现](/202604/29/2604.20389v1-cybercertbench-evaluating-llms-in-cybersecurity-certification-knowledge)（7.8/10）
   摘要：本研究介绍了CyberCertBench，一个基于行业认证的多选题评估基准，用于评估大语言模型（LLMs）在IT和OT（操作技术）领域的网络安全知识。实验表明，尽管前沿模型在IT安全知识上达到了专家级水平，但在需要厂商特定细节或标准化知识的领域，模型的表现明显下降。此研究揭示了LLMs在复杂领域应用中的潜在风险，值得关注其在高度专业化领域的可靠性。
4. [使用预测性遮蔽图自编码器预测单个网络流量（NetFlow）](/202604/29/2604.20483v1-forecasting-individual-netflows-using-a-predictive-masked-graph-autoencoder)（7.8/10）
   摘要：本文提出了一种基于图神经网络的预测掩码自编码器（Predictive Masked Graph Autoencoder）方法，用于对单个网络流（NetFlow）进行精细预测。通过构建包含IP、端口和连接节点的图结构，模型捕捉网络流的关系信息，实现对下一步流量的预测。实验表明，该方法在识别端口和IP的连接归属上优于现有强基线，同时特征重构表现具有竞争力，展示了GNN在单流预测中的潜力，值得对方法与实验细节进行深入阅读。
5. [低延迟大语言模型推理的混合JIT\-CUDA图优化](/202604/29/2604.23467v1-hybrid-jit-cuda-graph-optimization-for-low-latency-large-language-model-inference)（7.8/10）
   摘要：本文提出了一种混合 JIT\-CUDA 图执行框架，通过结合即时编译（JIT）与 CUDA 图执行，减少了大语言模型（LLM）推理中的启动开销，尤其是在交互式、短序列设置中。实验表明，使用该框架，Time\-to\-First\-Token \(TTFT\) 减少了最高 66%，并且在 P99 延迟上优于 TensorRT\-LLM。该研究提出的优化方法，适用于低延迟 AI 应用，但其可扩展性和多 GPU 支持尚未探索。
6. [动态网络靶场](/202604/29/2604.24184v1-dynamic-cyber-ranges)（7.8/10）
   摘要：本文针对传统静态网络演练（Cyber Ranges）在面对先进AI攻击时逐渐失效的问题，提出了动态网络演练（Dynamic Cyber Ranges），通过引入LLM驱动的防御代理实时监测、加固和响应攻击。实验显示，在相同场景下，攻击成功率从100%下降至0–55%，小型本地模型在防御中表现接近前沿模型，显示动态演练能有效延长AI评估的区分力。值得关注用于评估和设计新型网络安全防御策略。
7. [SAGE: Signal\-Amplified Guided Embeddings for LLM\-based Vulnerability Detection](/202604/29/2604.19031v1-sage-signal-amplified-guided-embeddings-for-llm-based-vulnerability-detection)（6.9/10）
   摘要：本文提出了一种新颖的SAGE框架，旨在解决大规模语言模型（LLM）在软件漏洞检测中的信号淹没问题。通过结合任务条件的稀疏自编码器（SAE），SAGE能够有效放大与漏洞相关的微弱信号，并抑制背景语义噪声。实验结果表明，SAGE在多个漏洞数据集上表现优异，显著提高了模型的检测性能，尤其在跨环境泛化能力方面具有显著优势。研究方法值得继续深入探讨，尤其对LLM在漏洞检测中的应用具有较高的参考价值。
8. [面向调查场景的人控大语言模型辅助 OpenSearch 的云原生架构](/202604/29/2604.21125v1-a-cloud-native-architecture-for-human-in-control-llm-assisted-opensearch-in-investigative-settings)（6.8/10）
   摘要：该论文提出了一种面向复杂刑事调查的云原生架构，结合大语言模型（LLM）和OpenSearch，通过自然语言查询与技术搜索逻辑之间的桥接，旨在提高调查效率。研究设计了一种混合检索策略，结合了BM25词汇检索和语义嵌入。初步验证通过Enron数据集展示了其技术可行性，系统提供了灵活、安全的部署选项。若你对云计算、LLM和信息检索结合的应用感兴趣，可深入阅读。
9. [MCP 漏洞实验室：揭示多向攻击下 MCP 工具服务器的开发者陷阱](/202604/29/2604.21477v1-mcp-pitfall-lab-exposing-developer-pitfalls-in-mcp-tool-server-security-under-multi-vector-attacks)（6.8/10）
   摘要：This paper introduces MCP Pitfall Lab, a protocol\-aware framework designed to expose developer pitfalls in the security of MCP tool servers under multi\-vector attacks. The framework includes a reproducible set of scenarios targeting common security vulnerabilities, such as tool metadata poisoning, puppet servers, and multimodal image\-to\-tool attacks. The study demonstrates that applying hardening strategies can eliminate security issues with minimal code changes. This paper is worth reading further for developers concerned with securing tool servers in complex environments involving multiple threat vectors。
10. [上下文永远不够长：面向大规模长文档集的结构化推理问答](/202604/29/2604.22294v1-contexts-are-never-long-enough-structured-reasoning-for-scalable-question-answering-over-long-document-sets)（6.8/10）
   摘要：本文提出了 SLIDERS 框架，旨在解决超长文档集合上的问答问题，通过将文本信息结构化存储到关系数据库，实现可扩展的推理与信息整合。实验显示，SLIDERS 在多个长上下文和超长上下文基准上显著超过现有方法，包括 GPT\-4.1。研究展示了结构化推理在处理百万级甚至千万级 token 文档集合上的潜力，值得深入阅读。
11. [M$^3$\-VQA：一个用于多模态、多实体、多跳推理的视觉问答基准](/202604/29/2604.25122v1-m3-vqa-a-benchmark-for-multimodal-multi-entity-multi-hop-visual-question-answering)（6.8/10）
   摘要：本文提出了 M$^3$\-VQA，一个新的基准，旨在评估多模态大语言模型在细粒度实体理解和复杂多跳推理中的能力。不同于传统的视觉问答数据集，M$^3$\-VQA 涉及多个不同实体的复杂问题，要求模型进行跨文档推理，且每一步推理都提供详细证据。实验结果表明，现有模型在没有外部知识的情况下表现较差，但当提供精确证据时，推理性能显著提升。该研究推动了多模态推理能力的评估，值得进一步细读。

---
使用键盘方向键可在日报/论文之间快速切换。
