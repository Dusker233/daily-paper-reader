# 日报 · 2026-06-27

- 生成时间：2026-06-27 21:38:39 UTC
- 当次推荐总数：12
- 精读区：1
- 速读区：11

## 今日简报（AI）
今天围绕大模型推理加速与系统安全研究进行了集中阅读，覆盖缓存优化与安全评估两大方向。  
最值得关注的是LLM推理侧的KV缓存自适应策略与LLC缓存驻留优化，同时安全方向聚焦Web漏洞检测与云基础设施风险评估。  
建议优先关注缓存与服务化优化思路在实际部署中的落地方式，同时加强对AI系统安全评测方法的理解。

## 精读区
1. [GB级最后级缓存中的缓存驻留LLM推理](/202606/27/2606.25353v1-cache-resident-llm-inference-in-gb-scale-last-level-caches)（8.1/10）
   摘要：论文面向具备GB级LLC的新型服务器CPU，研究如何降低LLM推理中的数据搬运与同步开销。提出缓存驻留执行模型，将权重与KV cache分离到不同资源域，并以子算子粒度调度减少同步。实现后在Llama\-3/2上获得2.04×–11.51× TPOT加速，分析模型可达13.9×，对CPU端高效推理具有较强参考价值，值得进一步精读系统设计与评估细节。

## 速读区
1. [面向大语言模型服务的基于近期性/频率自适应的KV缓存机制](/202606/27/2606.21238v1-recencyfrequency-adaptive-kv-caching-for-large-language-model-serving)（7.9/10）
   摘要：本文针对大模型推理中KV cache受限及LRU在混合工作负载下失效问题，引入ARC自适应缓存机制于vLLM，在近期性/频率双缓存间动态分配并利用ghost缓存实现更适配KV管理。在文档问答与对话任务中，KV命中率最高提升10.8%，首token时延下降12.6%，真实对话约2%提升，整体收益稳定但幅度有限，适合作为缓存策略优化参考。
2. [评估大语言模型用于真实世界Web漏洞检测](/202606/27/2606.21397v1-evaluating-llms-for-real-world-web-vulnerability-detection)（7.9/10）
   摘要：本文评估多种前沿与开源LLM在WordPress漏洞检测，采用agent式全代码静态分析与多提示词实验。结果显示Claude Opus 4.6达63%最高，MiniMax约48%，Qwen 3.5为35%；受限提示优于开放提示，复杂度影响有限，但一致性较差且存漏检基线漏洞，揭示能力与局限并存。
3. [现代人工智能与云基础设施安全性研究](/202606/27/2606.22237v1-investigating-the-security-of-modern-ai-and-cloud-infrastructure)（7.9/10）
   摘要：本文提出面向现代AI与云基础设施的统一安全分析框架，按交互层级划分攻击面，从共享内存、共享硬件到纯服务接口系统性验证威胁。展示侧信道泄露API密钥、Rowhammer及寄存器/栈攻击，以及仅输入驱动的LLM越狱方法，证明隔离假设在多层基础设施中失效。对AI与云安全交叉研究具有较高参考价值，适合精读。
4. [5G O\-RAN中的跨层入侵检测：融合无线遥测与网络流记录的收益与局限](/202606/27/2606.22450v1-cross-layer-intrusion-detection-in-5g-o-ran-gains-and-limits-of-fusing-radio-telemetry-with-network-flow-records)（7.9/10）
   摘要：本文研究5G O\-RAN中CU网络流与DU无线遥测跨层融合用于入侵检测的有效性。在NetsLab\-5GORAN\-IDD数据集上，采用7种模型与10次run\-disjoint划分，对比单模态与得分级融合。结果显示无线遥测整体不弱于甚至优于流量特征；融合仅在部分模型（如GRU/Transformer）低误报点提升检测率，其余模型反而下降，且DoS与正常流混淆长期存在。整体结论为融合收益具有条件性，值得对O\-RAN多模态IDS进行精读。
5. [过度知情的智能体：LLM智能体隐私的数据中心综述](/202606/27/2606.26627v1-agents-that-know-too-much-a-data-centric-survey-of-privacy-in-llm-agents)（7.9/10）
   摘要：本文围绕LLM智能体在数据库、RAG语料、API工具与长期记忆等多数据面操作时的隐私泄露问题，从数据流动视角系统综述相关攻击、风险类型与治理方法，并整理现有评测基准与研究空缺。作者指出当前方法碎片化严重，其中信息流控制在覆盖跨会话与组合推理泄漏方面最具潜力，但整体缺乏统一覆盖多数据面的隐私评测基准，因此对理解与进入该方向具有较高参考价值。
6. [迈向 Agentic SysAdmin：用 AI 代理重新思考系统管理](/202606/27/2606.26960v1-toward-agentic-sysadmin-rethinking-system-administration-with-ai-agents)（7.9/10）
   摘要：本文提出NetLLMeval，用网络仿真生成可验证的真实网络状态，自动评估LLM在网络运维任务中的表现。通过2.4万次实验对10种模型与4类求解架构进行对比，发现系统架构对性能提升极为关键，小型开源模型在合适agent框架下可接近甚至匹配前沿模型，同时揭示成本与效果的权衡关系，具有较高参考与复现价值。
7. [用于网络钓鱼与威胁分类的混合式多层级流水线：经独立验证的URL与NLP引擎及校准的多通道融合阶段](/202606/27/2606.21690v1-a-hybrid-multi-layered-pipeline-for-phishing-and-threat-classification-independently-validated-url-and-nlp-engines-with-a-calibrated-multi-channel-fusion-stage)（6.9/10）
   摘要：本文提出用于钓鱼邮件与威胁分类的多模态分层管线，将URL分析、DistilBERT文本模型与威胁情报同步独立建模，并通过校准的概率OR融合决策。在10,677邮件实验中整体F1达0.914，文本模型真实钓鱼召回由0.8%提升至87.3%，并降低误报至3.6%。但融合评估仍依赖代理通道且需再校准，适合对安全检测系统与多模态融合方法感兴趣的读者精读。
8. [ComputeFHE：一种隐私保护的通用计算库](/202606/27/2606.24379v1-computefhe-a-privacy-preserving-general-purpose-computation-library)（6.9/10）
   摘要：本文提出基于 TFHE 的开源 C\+\+ 通用隐私计算库 ComputeFHE，目标是降低全同态加密应用开发门槛并提升执行效率。库提供加密整数/定点类型、算术与逻辑运算、条件执行、隐匿数组访问及仿真模式，同时支持传统门级实现与优化 ALU 架构。实验表明部分操作可将 bootstrapping 开销降低，最高获得约 3.9× 性能提升。若关注 FHE 工程化、编程模型或性能优化，值得继续精读。
9. [基于多智能体语义重写的隐私保护RAG：在不牺牲上下文一致性的情况下实现机密性](/202606/27/2606.24623v1-privacy-preserving-rag-via-multi-agent-semantic-rewriting-achieving-confidentiality-without-compromising-contextual-fidelity)（6.9/10）
   摘要：提出面向RAG的多智能体隐私语义重写框架，通过隐私抽取、语义分析与重构删除敏感信息并保留语义。实验在ChatDoctor与Wiki\-PII及多模型上验证，显著降低攻击泄露（LLaMA\-3\-8B:144→1），同时保持生成质量（优于SAGE）。离线预处理无额外时延，具有较强实用价值。
10. [EG\-VQA：基于时序证据的可验证视频问答基准评测](/202606/27/2606.24797v1-eg-vqa-benchmarking-verifiable-video-question-answering-with-grounded-temporal-evidence)（6.9/10）
   摘要：本文提出EG\-VQA基准，将视频问答从仅答案预测扩展为必须生成时序证据的可验证推理任务。数据集包含2067个视频与11838个问答对，并提供细粒度时间段证据标注，同时提出EG\-F1联合衡量时间对齐与语义一致性。实验发现主流视频多模态模型虽答案准确率较高，但证据定位能力显著不足，暴露“答对但无依据”的问题，并提出EG\-Reasoner通过证据监督提升可解释推理与整体性能，整体具有较高精读价值。
11. [RAS：通过拒绝对齐衡量大语言模型安全性](/202606/27/2606.25750v1-ras-measuring-llm-safety-through-refusal-alignment)（6.9/10）
   摘要：本文提出SafeVec与RAS，从安全参考模型中提取“拒绝方向”，通过目标模型在安全/越狱提示下隐藏状态与该方向的对齐程度，在表征层面量化LLM安全性并映射为0\-100评分。实验覆盖Llama、Gemma、Qwen，显示该指标可区分对齐与非对齐/ablated模型，并与攻击成功率强相关，同时比基于LLM裁判的输出评估更高效，适合白盒安全审计。

---
使用键盘方向键可在日报/论文之间快速切换。
