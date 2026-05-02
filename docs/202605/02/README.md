# 日报 · 2026-05-02

- 生成时间：2026-05-02 20:14:50 UTC
- 当次推荐总数：16
- 精读区：5
- 速读区：11

## 今日简报（AI）
1\) 今日精读5篇，速读11篇，涵盖最新LLM框架和安全检测技术。  
2\) 最值得关注的是“端到端LLM框架用于威胁检测与处理”及“LLM驱动的网络配置修复基准”。  
3\) 下一步建议关注多智能体框架和大规模语言模型在网络安全中的应用潜力。

## 精读区
1. [迈向自主化的SOC运营：用于威胁检测、查询生成和安全运营中问题解决的端到端LLM框架](/202605/02/2604.27321v1-toward-autonomous-soc-operations-end-to-end-llm-framework-for-threat-detection-query-generation-and-resolution-in-security-operations)（8.7/10）
   摘要：本文提出了一个端到端的安全运营中心（SOC）威胁管理框架，集成了基于集成学习的威胁检测、基于语法约束的查询生成和检索增强的解决方案支持。通过结合传统机器学习与大语言模型（LLM），实现了高效的安全事件检测与快速响应。实验证明，该框架能显著降低误报率、提高查询生成效率并加快事件解决速度，适用于生产环境。该框架将会对SOC操作的自动化起到重要推动作用，值得进一步阅读以了解更多实验细节和应用场景。
2. [基于大型语言模型的网络配置修复基准测试](/202605/02/2604.22513v1-benchmarking-llm-driven-network-configuration-repair)（8.3/10）
   摘要：本文提出了一个新的基准测试框架Cornetto，旨在评估LLM（大语言模型）在网络配置修复中的有效性和安全性。通过合成多种不同规模和协议的网络配置问题，研究发现现有的LLM在修复过程中仍存在性能退化和回归问题，尤其是在大规模设置下。尽管LLM展示了初步潜力，但需要与正式验证结合才能确保其安全可靠。因此，继续研究如何在更复杂的网络环境中稳定应用LLM仍有意义。
3. [动态网络攻防靶场](/202605/02/2604.24184v1-dynamic-cyber-ranges)（8.0/10）
   摘要：本文针对静态网络靶场在LLM驱动攻击测试中的饱和问题，提出动态网络靶场，通过LLM防御代理实时监控和响应攻击，提升评估的对抗性。实验证明防御代理可将攻击成功率从100%降至0–55%，小型本地模型在某些场景下防御效果与前沿模型相当，值得进一步阅读以了解动态靶场设计和AI防御机制。
4. [面向自主化的安全警报调查](/202605/02/2604.25846v1-towards-agentic-investigation-of-security-alerts)（8.0/10）
   摘要：本文提出了一种基于大语言模型（LLM）的自动化安全警报调查工作流，旨在通过减少安全分析师的手动工作量，提高警报调查的效率和准确性。该工作流结合了预定义查询和受限工具访问，能够自动化执行警报调查的前期步骤。实验结果表明，LLM驱动的工作流在正确性和效率上优于传统的手动调查。研究表明该方法可以有效减少分析师的负担，并提高警报判断的准确性。
5. [大型语言模型作为能源工业控制系统可解释的网络攻击检测器](/202605/02/2604.26079v1-large-language-models-as-explainable-cyberattack-detectors-for-energy-industrial-control-systems)（8.0/10）
   摘要：本研究探讨了大语言模型（LLM）是否可以作为能源工业控制系统（ICS）中Modbus流量的辅助检测层。研究发现，LLM在不需特定任务训练的情况下，能够与传统监督模型相媲美，进行正常/危急流量的分类，并生成可审计的事件记录。该方法具有较高的检测精度（接近0.98）且无需特定训练，是传统方法的有效补充。值得精读，尤其是对Modbus协议的应用及实验结果的分析。

## 速读区
1. [面向大语言模型的网络边缘推理：原理、技术与机遇](/202605/02/2604.22906v1-network-edge-inference-for-large-language-models-principles-techniques-and-opportunities)（7.8/10）
   摘要：This paper discusses the challenges and opportunities of performing inference for large language models \(LLMs\) at the network edge, where resource constraints such as memory, computation, and bandwidth impact performance. It covers the principles, techniques, and recent progress in optimizing LLMs for edge environments, focusing on system architectures, model optimization, and resource management. The paper explores both model and hardware co\-optimization approaches to improve the efficiency of edge\-based inference, with applications in mobile devices and IoT. This survey is valuable for those interested in deploying large models on resource\-constrained devices, offering insights into current advancements and future directions。
2. [用于大型语言模型运行时失误检测的逐层收敛指纹](/202605/02/2604.24542v1-layerwise-convergence-fingerprints-for-runtime-misbehavior-detection-in-large-language-models)（7.8/10）
   摘要：This paper introduces Layerwise Convergence Fingerprinting \(LCF\), a runtime monitoring method to detect misbehavior in large language models \(LLMs\) without the need for retraining or additional models. LCF uses a health signal derived from inter\-layer hidden\-state differences, applying Mahalanobis distance, aggregation, and calibration to detect backdoors, jailbreaks, and prompt injections in deployed models. Experiments show that LCF effectively reduces backdoor attack success rates to below 1%, detects 92\-100% of jailbreaks, and flags 100% of prompt injections with minimal overhead. This approach offers a unified defense across multiple attack types without specific tuning for each. LCF is a promising method for runtime safety in LLMs, making it a potential candidate for further exploration in practical settings。
3. [MARD：一种用于强大安卓恶意软件检测的多智能体框架](/202605/02/2604.25264v1-mard-a-multi-agent-framework-for-robust-android-malware-detection)（7.8/10）
   摘要：本文提出了MARD，一个多代理框架，用于提升Android恶意软件检测的鲁棒性。MARD结合了大语言模型\(LLM\)和传统静态分析技术，通过自动化的多代理交互机制实现了高效的行为推理与低级逻辑取证。在实验中，MARD无须领域特定的微调，便达到了93.46%的F1得分，且在跨域泛化与概念漂移上的表现十分出色。对于对Android恶意软件检测方法感兴趣的研究者，值得继续精读。
4. [OpenSOC\-AI：通过参数高效的LLM日志分析实现安全运营民主化](/202605/02/2604.26217v1-opensoc-ai-democratizing-security-operations-with-parameter-efficient-llm-log-analysis)（7.8/10）
   摘要：本论文提出OpenSOC\-AI，旨在帮助资源有限的中小企业通过参数高效的微调小型语言模型进行安全日志分析，实现威胁分类和严重性评估。作者使用TinyLlama\-1.1B模型结合LoRA微调，仅用450个领域示例和1.13%的可训练参数，在单块NVIDIA T4 GPU上完成训练，显著提升威胁检测准确率。实验结果显示该方法在威胁分类和严重性评估上分别提高68和30个百分点，值得关注安全自动化和小模型应用研究。
5. [BLINC：面向自动化 RAN 配置的上下文特定因果学习](/202605/02/2604.27084v1-blinc-context-specific-causal-learning-for-automated-ran-configuration)（7.6/10）
   摘要：该研究提出了一种基于贝叶斯网络和大语言模型（LLM）结合的智能网络配置框架BLINC，旨在自动化优化无线接入网络（RAN）配置。通过分析网络部署日志和遥测数据，BLINC能够优化系统配置并提升网络性能。实验结果表明，相较于数据驱动的基准方法，BLINC在吞吐量上提高了63.5%，块错误率降低了19.7%。该方法为网络配置提供了可解释的因果结构，并能根据网络条件不断适应，适用于不同的部署场景。若读者对5G网络优化有兴趣，值得继续阅读。
6. [Automation\-Exploit：一种基于数字双胞胎的风险缓解型自适应进攻安全多智能体大语言模型框架](/202605/02/2604.22427v1-automation-exploit-a-multi-agent-llm-framework-for-adaptive-offensive-security-with-digital-twin-based-risk-mitigated-exploitation)（7.5/10）
   摘要：本文提出了Automation\-Exploit，一个自主多代理系统框架，用于在复杂黑盒环境中进行适应性攻防安全。该框架通过自动化的执行文件提取与情境智能获取，弥合了侦察与利用之间的抽象鸿沟，并通过数字双胞胎技术减轻DoS风险。实验证明，该框架能够有效避免‘Live Fire’崩溃，成功执行风险缓解的攻击。本文为自动化渗透测试提供了一种创新的解决方案，适合对攻防自动化与安全性技术感兴趣的读者深入阅读。
7. [使用生成性人工智能生成合成恶意软件样本](/202605/02/2604.22084v1-generating-synthetic-malware-samples-using-generative-ai)（6.8/10）
   摘要：本文提出一种基于生成式 AI 的合成恶意软件样本生成系统，用于缓解恶意软件数据集不平衡问题。方法将恶意软件二进制拆解为助记符操作码序列，并结合 NLP 提取上下文特征，利用 GAN、WGAN\-GP 及改进 Diffusion 模型生成数据。实验显示，Diffusion 合成数据显著提升小类样本分类性能约 60%，整体分类准确率提升至 96%，显示合成数据高质量和实际应用潜力，值得进一步精读。
8. [在对抗性环境中检测雪崩效应：发现勒索软件中的加密循环](/202605/02/2604.24131v1-detecting-avalanche-effect-in-adversarial-settings-spotting-the-encryption-loops-in-ransomware)（6.8/10）
   摘要：本研究针对勒索病毒中的加密循环进行逆向工程，提出了一种基于雪崩效应的新方法。通过统计检测和重放机制，该方法能有效识别加密循环并应对对抗性代码混淆。实验表明该方法具有极低的误报率（1.1%）和零漏报率，能够成功分析多个勒索病毒样本。该研究对深入理解勒索病毒加密机制有重要价值，值得进一步阅读。
9. [CAN\-QA：用于车载 CAN 流量推理的问答基准](/202605/02/2604.24935v1-can-qa-a-question-answering-benchmark-for-reasoning-over-in-vehicle-can-traffic)（6.8/10）
   摘要：本文提出 CAN\-QA，一个将车载 CAN 总线流量分析转化为问答任务的基准，用于提升对入侵检测的可解释性和推理能力。研究通过规则模板生成 33,128 个 QA 对，覆盖 10 类语义和时间特性，对大语言模型进行评测。结果显示，模型虽能捕捉表面统计特征，但在时间推理和多条件行为理解上存在明显不足。该研究值得关注，特别是面向安全关键系统的推理能力评估。
10. [FCMBench\-Video：文档视频智能基准测试](/202605/02/2604.25186v1-fcmbench-video-benchmarking-document-video-intelligence)（6.8/10）
   摘要：本文提出了FCMBench\-Video，一个用于评估文档视频智能的基准，旨在提升金融信用审核、远程验证等领域中文档视频理解的能力。通过构建包含495个原子视频、1200个长格式视频和11322个专家标注问答实例的数据集，FCMBench\-Video覆盖了28种文档类型，支持中文和英文，评估了多种视频模型在文档视频感知和证据推理方面的表现。实验表明，该基准能够有效区分不同模型的能力，特别是在跨文档验证和证据聚合任务上表现突出，适合用于衡量文档视频理解领域的进展。
11. [工业控制系统中跨工厂未知攻击检测的质心原型对齐](/202605/02/2604.25544v1-medoid-prototype-alignment-for-cross-plant-unknown-attack-detection-in-industrial-control-systems)（6.8/10）
   摘要：本研究提出了一种基于Medoid原型对齐的跨厂未知攻击检测框架，旨在解决工业控制系统（ICS）中跨厂检测问题。方法通过将不同厂区的流量压缩为统一表示空间，并利用K\-Medoids提取稳定的原型进行对齐。实验表明，该方法在多个未知攻击任务中表现优异，平均准确率为0.843，F1分数为0.838，且比其他方法更稳健。对于跨厂环境中实际部署的攻击检测，值得进一步精读。

---
使用键盘方向键可在日报/论文之间快速切换。
