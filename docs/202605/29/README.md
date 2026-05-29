# 日报 · 2026-05-29

- 生成时间：2026-05-29 22:04:52 UTC
- 当次推荐总数：12
- 精读区：1
- 速读区：11

## 今日简报（AI）
今天阅读了 12 篇前沿安全与交通研究论文，重点关注自动漏洞发现和大规模流量推断。  
最值得关注的是多智能体 LLM 系统在漏洞复现上的高效应用，以及多源数据驱动的城市级交通流预测方法。  
建议普通读者可关注智能系统在网络安全和交通管理中的实际落地案例，了解技术趋势。

## 精读区
1. [FuzzingBrain V2：用于自动化漏洞发现与复现的多代理大语言模型系统](/202605/29/2605.21779v1-fuzzingbrain-v2-a-multi-agent-llm-system-for-automated-vulnerability-discovery-and-reproduction)（8.0/10）
   摘要：本文提出了 FuzzingBrain V2，一个基于多智能体的 LLM 系统，用于自动化发现和复现软件漏洞。通过结合 OSS\-Fuzz 的可复现性、Suspicious Point 的精细定位以及层次化逻辑驱动的函数分析，系统在 AIxCC 2025 C/C\+\+ 数据集上实现了 90% 的漏洞检测率，并在真实开源项目中发现 29 个零日漏洞，提供了高效且可部署的漏洞检测方案。值得精读以了解其多智能体协作与漏洞复现机制。

## 速读区
1. [利用多源数据进行城市规模的鲁棒且可信的交通流推断](/202605/29/2605.25004v1-metropolis-scale-resilient-and-trustworthy-traffic-flow-inference-using-multi-source-data)（7.8/10）
   摘要：论文聚焦超大城市尺度交通状态推断，在固定检测器稀疏、传感器失效与部署变化场景下，如何同时实现高精度、可信不确定性量化和系统韧性。作者提出TA\-ANP，将神经过程、任务感知注意力、多源数据融合（FCD\+固定检测器）和Monte Carlo Dropout结合，并构建2371路段的MMTD数据集验证。实验表明其在估计、预测和概率校准上达到SOTA，同时具备更强传感网络扰动适应能力。若关注交通数字孪生、城市感知或可信AI交通应用，值得继续细读。
2. [利用检索增强生成与大语言模型在 SDN 中实现对 Carpet\-Bombing DDoS 攻击的智能检测与缓解](/202605/29/2605.26307v1-intelligent-detection-and-mitigation-of-carpet-bombing-ddos-attacks-in-sdn-using-retrieval-augmented-generation-and-large-language-models)（7.7/10）
   摘要：论文针对SDN环境中难以被传统方法发现的Carpet\-Bombing DDoS攻击，提出一种结合RAG与大语言模型的实时检测与缓解框架。方法通过接口级流量特征表示、语义向量嵌入、FAISS相似检索以及LLM推理完成攻击判别，无需传统监督训练和频繁重训练。实验比较了JSON与自然语言表示、多种LLM配置，并在多强度攻击场景下验证效果，其中Gemma\-4\-31B\-IT表现最佳。若关注LLM在网络安全中的零训练检测能力，值得进一步细读。
3. [通过大语言模型辅助符号执行发现可信执行环境中的输入验证缺失问题](/202605/29/2605.22058v1-finding-missing-input-validation-in-tees-via-llm-assisted-symbolic-execution)（7.5/10）
   摘要：本文提出SymTEE，一种结合大语言模型\(LLM\)的符号执行框架，用于在无需真实TEE环境下检测TEE应用的输入校验缺失问题。通过AST分析提取潜在漏洞代码片段，并利用LLM自动生成可供符号执行的轻量化测试程序。实验结果显示在26个漏洞样本上达到了100%精确率和92.3%召回率，且分析成本极低，表明该方法高效且具有实用价值。对于关注TEE安全自动化分析的读者值得精读。
4. [SEED：用于应对有限预算下概念漂移的半监督持续恶意软件检测](/202605/29/2605.24903v1-seed-semi-supervised-continual-malware-detection-for-tackling-concept-drift-on-a-budget)（7.5/10）
   摘要：论文关注恶意软件检测中的概念漂移与标注成本问题，提出半监督持续学习框架SEED，在仅部分标注数据可用时替代依赖语义结构的对比学习方案。其核心做法是利用SVD构建表示空间，为未标注样本匹配已标注样本并进行表示对齐，同时结合主动学习选择高不确定样本请求人工标注，并引入延迟缓冲区更新降低噪声传播。实验显示其在BODMAS和AndroZoo上明显优于半监督版HCL，尤其适用于语义结构较弱的数据集，值得关注其实验设计与表示学习机制。
5. [GradSentry：用于大语言模型微调中后门样本过滤的梯度谱熵方法](/202605/29/2605.26574v1-gradsentry-gradient-spectral-entropy-for-backdoor-sample-filtering-in-large-language-model-fine-tuning)（7.5/10）
   摘要：论文关注大语言模型微调阶段的不可信数据后门防御问题，提出GradSentry，通过分析单样本梯度矩阵奇异值谱的谱熵（Spectral Entropy）来识别投毒样本。作者发现后门样本梯度的谱能量分布更均匀，因此谱熵更高。该方法无需聚类和样本间比较，适用于LoRA与全参数微调，在1%\-90%投毒率范围内保持有效，并具有较低计算开销。若关注LLM训练数据安全与后门防御，该工作值得进一步细读。
6. [迈向网络安全超级智能（CSI）：什么是网络安全领域的最佳智能体执行框架？](/202605/29/2605.28334v1-towards-cybersecurity-superintelligence-csi-whats-the-best-harness-for-cybersecurity)（7.5/10）
   摘要：论文研究“网络安全智能体到底该用哪种 agent scaffold（执行框架）”这一问题，提出统一多种异构 scaffold 的 CSI 元框架，并在同一模型 alias2\-mini 下对 5 种 scaffold 做 cybench 基准测试。结果发现不存在绝对最优 scaffold，不同 scaffold 在题目上呈明显互补性；进一步通过 blackboard 多智能体协作，将解题率从单体最佳的 45.5% 提升到 57.6%，且更快、成本接近。若关注 AI Agent、CTF 自动化或多智能体协作，这篇值得细读。
7. [前沿大语言模型已准备好用于网络安全了吗？来自双模式漏洞基准的证据：垂直领域基础模型的必要性](/202605/29/2605.23243v1-are-frontier-llms-ready-for-cybersecurity-evidence-for-vertical-foundation-models-from-dual-mode-vulnerability-benchmarks)（6.8/10）
   摘要：论文评估前沿大模型是否已具备网络安全能力，构建白盒漏洞检测（VulnLLM\-R）与黑盒Web渗透测试双模式基准，对6个前沿模型和2个领域模型进行系统比较。结果显示前沿模型误报率高、真实漏洞覆盖率极低，即使结合安全工具提升也有限；而编码了渗透测试方法论的垂直安全模型显著提升检测效果与精度。若关注AI安全、Agent与垂直大模型方向，值得继续细读。
8. [时间概念漂移下的对抗脆弱性：Android恶意软件检测的纵向研究](/202605/29/2605.23623v1-adversarial-vulnerability-under-temporal-concept-drift-a-longitudinal-study-of-android-malware-detection)（6.8/10）
   摘要：本文研究了 Android 恶意软件检测系统在时间概念漂移下的对抗脆弱性，使用跨年和扩展窗口的纵向数据集，结合静态与动态特征进行评估。通过 FGSM 和 SPSA 攻击生成对抗样本，并引入 RobustDrop、∆ASR 与对抗放大因子等指标量化时间漂移对模型稳健性的影响。结果显示，随时间差距增加，干净精度与对抗精度下降，攻击成功率上升，扩展窗口重训练能缓解但无法完全消除稳健性损失。研究表明，在长期部署的智能检测系统中考虑时间漂移与对抗评估至关重要，值得深入阅读。
9. [提升基于大语言模型的安全代码生成可靠性](/202605/29/2605.24300v1-enhancing-reliability-in-llm-based-secure-code-generation)（6.8/10）
   摘要：论文关注 LLM 生成代码的安全可靠性不稳定问题，提出 MA\-CoT（Mitigation\-Aware Chain\-of\-Thought）框架，通过任务相关 CWE 缓解措施、统一安全规则和语言感知提示，引导模型生成更安全代码。作者在 3 个模型、3 种语言、4 类提示策略和双数据集上评测，显示 MA\-CoT 显著降低漏洞数量与高危问题，并且是唯一跨语言、跨数据集表现稳定的方法。若关注安全代码生成与提示工程结合机制，值得继续细读。
10. [按家族与类型构建对抗性恶意软件数据集：生成、规避与投毒评估](/202605/29/2605.25937v1-building-an-adversarial-malware-dataset-by-family-and-type-generation-evasion-and-poisoning-evaluation)（6.8/10）
   摘要：论文构建了一个基于真实恶意软件数据集 RawMal\-TF 的大规模对抗恶意软件数据集，通过多种自动化对抗样本生成器对 PE 文件进行保持功能的修改，生成按家族和类型标注的对抗样本，并评估其逃逸能力与数据投毒影响。结果显示，对 EMBER 分类器的逃逸率分别达到 98.35% 和 92.20%；更重要的是，仅注入 0.5% 完全错误标注的对抗样本即可使重训练分类器的逃逸率从 26.1% 飙升至 92.8%。若关注对抗恶意软件、鲁棒性训练或数据投毒研究，值得继续细读。
11. [针对信息物理系统中故障检测与定位的后门攻击](/202605/29/2605.27674v1-backdoor-attacks-on-fault-detection-and-localization-in-cyber-physical-systems)（6.8/10）
   摘要：论文关注网络物理系统（CPS）中基于机器学习的故障检测与定位模型面临的后门攻击风险。作者提出一种基于LLM与对比学习的故障检测定位架构，并设计后门触发器生成与投毒方案，在IEEE 123\-bus电力系统场景下评估攻击效果。结果显示即使仅10%训练数据被污染，攻击仍能成功诱导模型输出错误结果。若关注AI安全、电网安全或CPS鲁棒性，值得继续阅读；若关注防御机制，则本文提供的信息较有限。

---
使用键盘方向键可在日报/论文之间快速切换。
