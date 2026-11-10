import{t as e}from"./client-CFAPvBvH.js";import{n as t}from"./index-hdAyjjlX.js";import{i as n,n as r,r as i,t as a}from"./schemas-CXXB6Owq.js";var o=r().describe(`IELTS band for this criterion: 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5 or 9`),s=i({scores:i({task:o.describe(`Task Achievement (Task 1) / Task Response (Task 2)`),coherence:o.describe(`Coherence and Cohesion`),lexical:o.describe(`Lexical Resource`),grammar:o.describe(`Grammatical Range and Accuracy`)}),reasons:i({task:n().describe(`Vì sao band này cho Task Achievement/Response – bám descriptor, tiếng Việt, 1–3 câu`),coherence:n().describe(`Vì sao band này cho Coherence & Cohesion – tiếng Việt`),lexical:n().describe(`Vì sao band này cho Lexical Resource – tiếng Việt, nêu ví dụ từ bài`),grammar:n().describe(`Vì sao band này cho Grammar – tiếng Việt, nêu ví dụ lỗi`)}),summary:n().describe(`Nhận xét tổng quan bằng tiếng Việt, 2–4 câu, nói rõ bài đang ở band nào và cần gì để lên band tiếp theo`),strengths:a(n()).describe(`Điểm mạnh (tiếng Việt), tối đa 3`),improvements:a(n()).describe(`Việc cần làm để lên band cao hơn (tiếng Việt), cụ thể, tối đa 5`),corrections:a(i({original:n().describe(`Trích nguyên văn đoạn sai trong bài`),corrected:n().describe(`Bản sửa (tiếng Anh)`),kind:n().describe(`grammar | vocabulary | spelling | punctuation | cohesion | task`),explanation:n().describe(`Giải thích ngắn bằng tiếng Việt`)})).describe(`Lỗi quan trọng nhất trước, tối đa 12`),corrected:n().describe(`Toàn bộ bài sau khi sửa HẾT lỗi nhưng giữ nguyên ý, cách diễn đạt, thứ tự câu và xuống dòng – chỉ đổi chỗ sai (app so sánh từng từ nên sửa tối thiểu)`),improved:n().describe(`Bản viết lại ở band cao hơn khoảng 1 band, giữ ý và bố cục của người viết, đúng số từ yêu cầu`),upgrades:a(i({from:n(),to:n()})).describe(`Cụm từ/cấu trúc nâng cấp đáng học (from = cách người viết dùng, to = cách tốt hơn), 5–10 cặp`)}),c=`You are a certified IELTS Writing examiner. Grade strictly according to the public IELTS Writing band descriptors. Vietnamese learners use this app; write all comments in Vietnamese, but corrections and rewritten texts in English.

Key descriptor anchors (apply to both tasks unless stated):

TASK ACHIEVEMENT (Task 1) / TASK RESPONSE (Task 2)
9: fully addresses all parts; fully developed position / clear overview with all key features well selected and illustrated.
8: sufficiently addresses all parts; well-developed response; Task 1: clear overview, key features clearly presented and appropriately illustrated.
7: addresses all parts; clear position throughout; main ideas extended and supported but may over-generalise or lack focus; Task 1: clear overview of main trends/differences/stages, key features highlighted but could be more fully extended.
6: addresses all parts though some more fully than others; relevant position but conclusions may be unclear or repetitive; ideas relevant but insufficiently developed; Task 1: overview present, key features adequately covered but details may be irrelevant/inaccurate.
5: addresses the task only partially; position expressed but development unclear; limited ideas, may be irrelevant; Task 1: no clear overview, mechanical recounting of detail, may be inaccurate.
4: responds minimally or tangentially; position unclear; Task 1: fails to cover key features, may confuse data.
Under-length (<150 Task 1, <250 Task 2) is penalised in this criterion. Memorised/templated content earns no credit.

COHERENCE AND COHESION
9: cohesion attracts no attention; skilful paragraphing.
8: sequences information logically; manages all aspects of cohesion well; paragraphing sufficient and appropriate.
7: logically organises information; clear progression; range of cohesive devices with some under/over-use; clear central topic in each paragraph.
6: coherent arrangement, overall progression; cohesive devices used effectively but may be faulty or mechanical; referencing may be unclear; paragraphing may be illogical.
5: some organisation but lack of overall progression; inadequate/inaccurate/overused cohesive devices; repetitive; paragraphing may be inadequate.
4: not arranged coherently; basic cohesive devices inaccurate or repetitive; no paragraphing or confusing paragraphs.

LEXICAL RESOURCE
9: wide range, natural and sophisticated control; rare minor slips.
8: wide range used fluently and flexibly; skilful use of uncommon items with occasional inaccuracies; rare spelling/word formation errors.
7: sufficient range for flexibility and precision; less common items with some awareness of style and collocation; occasional errors.
6: adequate range; attempts less common vocabulary with some inaccuracy; some spelling/word-formation errors that do not impede communication.
5: limited range, minimally adequate; noticeable errors that may cause difficulty for the reader.
4: basic vocabulary, repetitive, inappropriate; errors may cause strain.

GRAMMATICAL RANGE AND ACCURACY
9: wide range with full flexibility and accuracy; rare slips.
8: wide range; majority of sentences error-free; only very occasional errors.
7: variety of complex structures; frequent error-free sentences; good control, a few errors persist.
6: mix of simple and complex forms; some errors in grammar/punctuation but rarely reduce communication.
5: limited range of structures; complex sentences attempted but faulty; frequent errors that may cause difficulty.
4: very limited range, rare subordinate clauses; frequent errors, punctuation often faulty.

Half bands (e.g. 6.5) are allowed when a criterion sits between two descriptors. Be calibrated and honest – do not inflate: a typical Vietnamese learner essay with repeated article/tense errors and template phrases is band 5.5–6.5. Quote examples from the candidate's text when justifying lexical and grammar bands.

For "corrected": fix every error (grammar, vocabulary, spelling, punctuation) but otherwise leave the text unchanged – same ideas, wording, order and line breaks – the app shows a word-level diff. For "improved": rewrite about one band higher, keep the writer's ideas and paragraph structure, within the word limit. Never copy the sample answer if one is provided; it is only for calibration.`;function l(e,t,n){let r=t.trim().split(/\s+/).filter(Boolean).length,i=e.task===1?150:250;return`IELTS ${e.module===`general`?`General Training`:`Academic`} Writing Task ${e.task} (${e.type})
Prompt: ${e.prompt}
${e.chart?`Chart data: ${JSON.stringify(e.chart)}`:``}
Minimum words: ${i}. Candidate wrote ${r} words${n?` in about ${n} minutes`:``}.

Candidate's answer:
${t.trim()||`(left blank)`}
${e.sample?`\nSample answer (calibration only, do not copy):\n${e.sample}`:``}

Grade this answer.`}async function u(n,r,i,a){let o=await e(i,s,c,l(n,r,a),{maxTokens:2e4}),u=e=>Math.max(1,Math.min(9,Math.round(e*2)/2)),d={task:u(o.scores.task),coherence:u(o.scores.coherence),lexical:u(o.scores.lexical),grammar:u(o.scores.grammar)};return{...o,scores:d,overall:t(Object.values(d))}}export{u as gradeWriting};