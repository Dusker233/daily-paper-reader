# 日报 · 2026-04-26

- 生成时间：2026-04-26 19:50:43 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天成功完成了17篇文章的阅读与评估，其中精读6篇，速读11篇。值得关注的方向包括LLM在安全运营中的威胁狩猎表现和基于RAG的防御文档问答性能。建议进一步探索隐私保护神经网络在低延迟、高吞吐量推理中的潜力。

## 精读区
1. [网络防御基准：面向 SecOps 的 LLM 代理威胁狩猎评估](/202604/26/2604.19533v2-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.3/10）
   摘要：This paper presents the Cyber Defense Benchmark, which evaluates the effectiveness of large language models \(LLMs\) in performing agentic threat hunting tasks based on raw Windows event logs. The benchmark tests LLMs’ ability to identify malicious event timestamps in unsupervised, evidence\-driven environments without guided questions or hints. Despite strong Q&A performance on curated benchmarks, LLMs fall short in this task. The best model, Claude Opus 4.6, only reaches a Coverage Score of 0.55, demonstrating significant gaps in LLMs' capacity for open\-ended threat hunting. This suggests a need for further improvement in agentic reasoning for cybersecurity tasks。
2. [网络防御基准：面向 SecOps 的 LLM 主动威胁狩猎评估](/202604/26/2604.19533v3-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.3/10）
   摘要：本文介绍了Cyber Defense Benchmark，一个用来评估大型语言模型（LLMs）在安全操作中心（SOC）中的威胁狩猎任务执行能力的基准。该基准使用了106种真实攻击行为数据，测试LLMs如何通过分析Windows事件日志来识别恶意活动的时间戳。实验结果表明，即使是最强的模型（Claude Opus 4.6），其平均覆盖率分数也仅为0.55，远未达到≥50%的召回率要求，表明现有的LLM在处理开放式、证据驱动的威胁狩猎任务时表现不佳。论文为LLM在网络防御中的应用设立了严谨的基准。
3. [TitanCA：从协调大型语言模型代理发现 100\+ 个 CVE 的经验教训](/202604/26/2604.17860v1-titanca-lessons-from-orchestrating-llm-agents-to-discover-100-cves)（8.0/10）
   摘要：TitanCA项目展示了通过协调多个大规模语言模型（LLM）驱动的智能体来发现软件漏洞的策略。该方法通过四模块架构（匹配、过滤、检查和适应），成功地识别了203个零日漏洞，并发布了118个CVE。TitanCA比传统的静态应用安全测试工具（SAST）更高效，并在实际部署中取得了显著成果。这项研究的创新在于通过多模型协作，改进了漏洞检测的精确度，值得深入阅读以了解技术细节。
4. [MASS\-RAG：多代理合成检索增强生成](/202604/26/2604.18509v2-mass-rag-multi-agent-synthesis-retrieval-augmented-generation)（8.0/10）
   摘要：本研究提出MASS\-RAG，一种多智能体合成检索增强生成框架，旨在提升大语言模型在检索上下文噪声、不完整或异质时的答题准确性。通过引入角色专门化的过滤、摘要、抽取和推理代理，并在合成阶段统一输出，实验显示在多基准测试中优于传统单智能体RAG方法，尤其适用于证据分布分散的场景。论文值得继续精读以理解多智能体协作机制及其对生成质量的提升作用。
5. [基于大语言模型代理推理的 Node.js 包污点式漏洞检测与确认](/202604/26/2604.20179v1-taint-style-vulnerability-detection-and-confirmation-for-nodejs-packages-using-llm-agent-reasoning)（8.0/10）
   摘要：本文针对 Node.js 包的污点式安全漏洞检测提出了 LLMVD.js，一种基于大语言模型（LLM）代理的多阶段自动化流程，包括漏洞扫描、漏洞提议、PoC 演示生成及轻量级验证。实验显示，在公共基准上 LLMVD.js 确认率达 84%，显著高于传统程序分析工具，并在近期发布的包中发现 36 个未报告漏洞。研究方法新颖且效果显著，值得深入阅读。
6. [TL\-RL\-FusionNet：一种自适应高效的强化学习驱动迁移学习框架用于检测演化型勒索软件威胁](/202604/26/2604.20260v1-tl-rl-fusionnet-an-adaptive-and-efficient-reinforcement-learning-driven-transfer-learning-framework-for-detecting-evolving-ransomware-threats)（8.0/10）
   摘要：本研究提出了TL\-RL\-FusionNet框架，结合了强化学习（RL）和迁移学习（TL）技术，用于检测不断变化的勒索病毒威胁。通过将冻结的EfficientNetB0和InceptionV3模型与轻量级残差MLP分类器结合，RL代理动态调整样本权重，从而提高对复杂和变种勒索病毒的检测能力。实验表明，该方法在准确性、召回率等方面表现优越，同时显著减少了计算成本，是一种高效的实时勒索病毒检测方法。值得进一步精读，特别是对于方法的细节和实验结果部分。

## 速读区
1. [网络防御基准：面向安全运维的 LLM 主动威胁狩猎评估](/202604/26/2604.19533v1-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（7.9/10）
   摘要：本论文提出了网络防御基准，评估大语言模型（LLM）在安全运营中心（SOC）分析师核心任务——威胁猎杀中的表现。实验利用真实的攻击数据，测试了多种LLM模型，结果显示现有模型在处理开放式、证据驱动的威胁猎杀任务时表现不佳，最好的模型仅能正确识别3.8%的恶意事件。该研究展示了LLM在此类任务上的局限性，并为未来提升LLM在网络防御中的应用提供了基准。
2. [面向领域的RAG评估（DoRA）：基于国防文档的RAG问答合成基准测试](/202604/26/2604.17943v1-domain-oriented-rag-assessment-dora-synthetic-benchmarking-for-rag-based-question-answering-on-defense-documents)（7.9/10）
   摘要：本研究提出了一个基于国防文件的领域定向RAG评估基准DoRA，用于解决开放领域RAG基准存在的污染、意图不匹配和度量不对齐等问题。通过合成类型条件化的问答对，并结合可审计的证据片段，DoRA展示了在国防领域的应用场景下，基于DoRA训练的模型在QA任务成功率和幻觉率方面有显著提升。实验结果表明，DoRA能有效地支持领域适配，减小开放领域基准对实际部署性能的高估，具有较高的实用价值，尤其在安全和国防等高风险场景中。
3. [迈向深度加密训练：低延迟、内存高效且高吞吐量的隐私保护神经网络推理](/202604/26/2604.16834v1-towards-deep-encrypted-training-low-latency-memory-efficient-and-high-throughput-inference-for-privacy-preserving-neural-networks)（7.8/10）
   摘要：本文针对隐私保护神经网络中的同态加密（HE）推理瓶颈，提出面向批处理的优化算法和流水线架构，实现低延迟、高吞吐量、节省内存的加密神经网络推理。通过在HE\-friendly ResNet\-20/34上处理CIFAR\-10/100加密数据，实验显示推理时间和内存使用均显著优于现有方法。研究对于希望在深度学习中保持数据隐私的场景具有较高参考价值，值得进一步精读。
4. [GAMMA\-Net：基于交替图注意力和多轴Mamba的自适应长时间交通时空预测模型](/202604/26/2604.16859v1-gamma-net-adaptive-long-horizon-traffic-spatio-temporal-forecasting-model-based-on-interleaved-graph-attention-and-multi-axis-mamba)（7.8/10）
   摘要：本研究提出了一种名为GAMMA\-Net的新型长时域交通时空预测模型，通过结合图注意力网络（GAT）和多轴选择性状态空间模型（Mamba），有效地捕捉了交通数据中的时空依赖性。该模型在多个交通数据集上进行了广泛的实验，表现出较传统方法更高的准确度，尤其在长时间预测方面。GAMMA\-Net能在保证实时性和计算效率的同时，提供更为精确的交通预测，值得深入阅读。
5. [面向进攻性网络任务的前沿大型语言模型系统能力基准评估](/202604/26/2604.17159v1-systematic-capability-benchmarking-of-frontier-large-language-models-for-offensive-cyber-tasks)（7.8/10）
   摘要：本论文系统评估了10款前沿大型语言模型（LLM）在进攻性网络安全任务中的能力，通过在NYU CTF Bench的200个挑战上对比不同模型、环境（Ubuntu vs. Kali）、提示策略和多智能体架构的表现，发现环境工具配置和模型选择对性能影响最大，而提示工程收益有限。Claude 4.5 Opus表现最佳，Gemini 3 Flash在成本效率上最优。研究提供可复现实验平台，对安全AI能力评估具有参考价值。
6. [ExAI5G：基于逻辑的可解释人工智能框架用于5G网络中的入侵检测](/202604/26/2604.18052v1-exai5g-a-logic-based-explainable-ai-framework-for-intrusion-detection-in-5g-networks)（7.8/10）
   摘要：本研究提出了ExAI5G框架，旨在提高5G网络入侵检测系统的可解释性。通过将基于Transformer的深度学习模型与逻辑驱动的可解释人工智能（XAI）技术结合，该框架提供了清晰的规则解释，确保模型高性能的同时，提升了信任度。实验结果表明，ExAI5G在5G物联网入侵数据集上的准确率达到99.9%，并且通过逻辑规则的提取，模型的推理过程具有99.7%的保真度。若读者关注AI模型的可解释性和透明度，本文值得进一步精读。
7. [文档与问题对齐：面向问题的文档重写用于检索增强生成](/202604/26/2604.17325v1-align-documents-to-questions-question-oriented-document-rewriting-for-retrieval-augmented-generation)（6.8/10）
   摘要：This paper presents QREAM, a style\-controlled document rewriter designed for Retrieval\-Augmented Generation \(RAG\) systems. By aligning retrieved documents with a question\-oriented style while preserving factual accuracy, QREAM aims to improve LLMs' performance in knowledge\-intensive tasks like Open\-Domain Question Answering \(ODQA\). Experiments show that QREAM enhances RAG pipelines, improving accuracy by up to 8% without significant latency overhead. It is a valuable method for those interested in improving factual accuracy and stylistic coherence in RAG systems。
8. [RARE：面向高相似语料的冗余感知检索评估框架](/202604/26/2604.19047v1-rare-redundancy-aware-retrieval-evaluation-framework-for-high-similarity-corpora)（6.8/10）
   摘要：本研究提出了RARE框架，旨在应对现有QA基准无法反映高冗余和高相似度语料库的问题。通过分解文档为原子事实并结合LLM生成高质量数据，RARE能够更真实地评估现实世界中高冗余语料库的检索任务。实验表明，在金融、法律和专利领域，传统基准未能有效捕捉模型在高冗余环境下的表现差异，RARE能够反映这些差距。该框架为领域特定的RAG评估提供了新的方向，值得继续细读以深入了解方法实现细节。
9. [基于机器学习检测的大语言模型生成的混淆 XSS 有害负载评估](/202604/26/2604.19526v1-evaluating-llm-generated-obfuscated-xss-payloads-for-machine-learning-based-detection)（6.8/10）
   摘要：本研究探索了使用大型语言模型（LLMs）生成和评估模糊化的跨站脚本攻击（XSS）载荷，以提高机器学习检测系统的鲁棒性。方法结合了确定性变换和基于LLM的生成，并通过浏览器运行时行为进行验证。实验结果显示，通过对行为保持源目标对进行微调，匹配率有所提高，但仍未能显著提高检测性能。研究表明，LLMs在生成保持运行时行为的模糊化载荷方面仍面临挑战，值得继续探索生成数据与行为验证结合的方法。
10. [面向细粒度视频理解的Sink\-Token感知剪枝在高效视频大语言模型中的应用](/202604/26/2604.20937v1-sink-token-aware-pruning-for-fine-grained-video-understanding-in-efficient-video-llms)（6.8/10）
   摘要：本文针对视频大语言模型（Video LLMs）在精细视频理解任务中存在的视觉 token 冗余和性能崩溃问题，提出了 Sink\-Token\-Aware Pruning（SToP）方法，通过识别和抑制“sink token”提升视觉 token 剪枝效果。实验显示，在多种基准（包括 hallucination、MCQA 和开放式生成任务）上，SToP 即便在剪枝 90% token 下也显著提高性能，值得关注精读以理解其方法与实际应用潜力。
11. [DWTSumm：用于文档摘要的离散小波变换](/202604/26/2604.21070v1-dwtsumm-discrete-wavelet-transform-for-document-summarization)（6.8/10）
   摘要：本研究提出了一种基于离散小波变换（DWT）的多分辨率文档摘要框架，旨在解决长文档和领域特定文档的总结问题。该方法通过将文本视为语义信号，将其分解为全局（近似）和局部（细节）成分，有效地减小输入长度并保持语义一致性，特别是在临床和法律领域的应用中。实验表明，与基线模型相比，DWT方法能够显著提高摘要的语义保真度和事实一致性，是一个轻量化且可扩展的解决方案。值得进一步精读，尤其是对实验结果的深度分析部分。

---
使用键盘方向键可在日报/论文之间快速切换。
