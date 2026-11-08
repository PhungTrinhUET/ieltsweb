// Nội dung mẫu đi kèm app (tự soạn, đúng format IELTS) – để dùng thử ngay và làm ví dụ cho file nạp vào.
import type { Material } from '../types';

const T0 = 1_700_000_000_000;

export const SAMPLE_MATERIALS: Material[] = [
  // ======================= READING =======================
  {
    id: 'r-urban-bees', skill: 'reading', builtin: true, addedAt: T0, title: 'The Rise of Urban Beekeeping', topic: 'Environment', level: 'medium', module: 'academic', minutes: 20,
    passage: `A Over the past two decades, beehives have appeared in some unexpected places: on the roofs of opera houses, in the gardens of office blocks and on the balconies of apartment buildings. Urban beekeeping, once a curiosity practised by a handful of enthusiasts, has become a mainstream hobby in cities from Paris to Melbourne. In London alone, the number of registered hives more than tripled between 2008 and 2018, and similar growth has been reported in New York, Berlin and Tokyo.

B The appeal is easy to understand. Keeping bees offers city dwellers a tangible connection with nature, a modest supply of honey and the satisfying sense of doing something for the environment. Media coverage of declining bee populations has turned the honeybee into a symbol of ecological concern, and many people have concluded that the most direct way to help is to keep a hive of their own. Companies, too, have embraced the trend; a rooftop apiary is now a familiar feature of corporate sustainability reports.

C Yet a growing number of ecologists argue that the enthusiasm is misplaced. The honeybee, they point out, is a managed, domesticated species and is not in danger of extinction. The insects that genuinely need help are wild pollinators: solitary bees, bumblebees, hoverflies and butterflies, many of which have suffered dramatic declines. A single honeybee colony can contain 50,000 individuals, each foraging over several kilometres, and when hives are densely packed into a city, they compete with wild species for the same limited supply of nectar and pollen. A study in Paris found that in districts with the highest hive densities, wild bee abundance was noticeably lower than in comparable areas with few hives.

D The problem is one of supply and demand. Flowers in a city are finite, and a typical urban park cannot support an unlimited number of foragers. Researchers in London calculated in 2020 that the capital's hives would require roughly four times the floral resources actually available if every colony were to thrive. Honey yields have fallen accordingly: some long-established beekeepers report that their hives now produce less than half the honey they did fifteen years ago, which they attribute directly to overcrowding.

E None of this means that urban bees are a bad idea in themselves. Managed well, a small number of hives can coexist with wild pollinators, and beekeeping remains an excellent way to teach people about ecology. The issue is scale and intention. Critics suggest that anyone who wants to help pollinators should think first about planting rather than keeping. A window box of lavender or a strip of wildflowers does more for a city's insect life than another hive, because it increases the amount of food available rather than the number of mouths competing for it.

F Some cities have begun to respond. Several Parisian districts now require would-be beekeepers to demonstrate that there is sufficient forage nearby before granting a permit, and Berlin's environment agency publishes guidance advising residents against installing new hives in already saturated neighbourhoods. In Melbourne, a coalition of community gardens has shifted its focus from hives to 'bee hotels' – bundles of hollow stems and drilled wood that provide nesting sites for solitary species – alongside a programme of pollinator-friendly planting.

G Whether these measures will reverse the trend remains to be seen. The image of the rooftop hive is a powerful one, and it is far easier to photograph a beekeeper in a veil than a patch of wildflowers. But the lesson of the urban beekeeping boom is a broader one about environmental action: the most visible gesture is not always the most useful, and good intentions, however sincere, are no substitute for understanding how an ecosystem actually works.`,
    groups: [
      {
        instruction: 'The reading passage has seven paragraphs, A–G. Choose the correct heading for each paragraph from the list of headings below.',
        bank: ['Why keeping bees attracts people', 'A better alternative to hives', 'Official attempts to limit hive numbers', 'The spread of a hobby', 'The wrong species getting the attention', 'A general lesson about helping the environment', 'Evidence that food is running out', 'How honey is produced in cities'],
        questions: [
          { no: 1, type: 'match', text: 'Paragraph A', answer: 3, explanation: 'Đoạn A nói về sự lan rộng của sở thích nuôi ong ở các thành phố (number of hives tripled) → "The spread of a hobby".' },
          { no: 2, type: 'match', text: 'Paragraph B', answer: 0, explanation: '"The appeal is easy to understand" – lý do người ta thích nuôi ong.' },
          { no: 3, type: 'match', text: 'Paragraph C', answer: 4, explanation: 'Ong mật không nguy cấp; loài cần giúp là ong hoang dã → "The wrong species getting the attention".' },
          { no: 4, type: 'match', text: 'Paragraph D', answer: 6, explanation: 'Hoa trong thành phố hữu hạn, sản lượng mật giảm → bằng chứng thức ăn cạn kiệt.' },
          { no: 5, type: 'match', text: 'Paragraph E', answer: 1, explanation: '"think first about planting rather than keeping" – trồng hoa là lựa chọn tốt hơn.' },
          { no: 6, type: 'match', text: 'Paragraph F', answer: 2, explanation: 'Paris yêu cầu giấy phép, Berlin khuyến cáo → chính quyền hạn chế số tổ ong.' },
          { no: 7, type: 'match', text: 'Paragraph G', answer: 5, explanation: '"the lesson … is a broader one about environmental action".' },
        ],
      },
      {
        instruction: 'Do the following statements agree with the information given in the reading passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.',
        questions: [
          { no: 8, type: 'tfng', text: 'The number of hives in London increased by more than 200% in ten years.', answer: 'TRUE', explanation: '"more than tripled between 2008 and 2018" = tăng hơn 200%.' },
          { no: 9, type: 'tfng', text: 'Honeybees are at risk of dying out.', answer: 'FALSE', explanation: '"is not in danger of extinction".' },
          { no: 10, type: 'tfng', text: 'The Paris study was carried out by the city government.', answer: 'NOT GIVEN', explanation: 'Bài chỉ nói "A study in Paris found…", không nói ai thực hiện.' },
          { no: 11, type: 'tfng', text: 'Some beekeepers blame lower honey production on too many hives.', answer: 'TRUE', explanation: '"which they attribute directly to overcrowding".' },
        ],
      },
      {
        instruction: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.', wordLimit: 'NO MORE THAN TWO WORDS',
        questions: [
          { no: 12, type: 'fill', text: 'Research in London estimated that the city\'s hives would need about four times the ___ available.', answer: ['floral resources'], explanation: 'Đoạn D: "roughly four times the floral resources actually available".' },
          { no: 13, type: 'fill', text: 'In Melbourne, community gardens now build ___ to give solitary bees somewhere to nest.', answer: ['bee hotels'], explanation: 'Đoạn F: "\'bee hotels\' – bundles of hollow stems…".' },
          { no: 14, type: 'fill', text: 'The writer concludes that sincere ___ cannot replace an understanding of ecosystems.', answer: ['good intentions', 'intentions'], explanation: 'Đoạn G: "good intentions, however sincere, are no substitute for understanding".' },
        ],
      },
    ],
    translation: [
      'Trong hai thập kỷ qua, các tổ ong xuất hiện ở những nơi không ngờ tới: trên mái nhà hát opera, trong vườn các toà văn phòng và trên ban công chung cư. Nuôi ong đô thị, từng là thú vui lạ của vài người đam mê, đã trở thành sở thích phổ biến ở các thành phố từ Paris đến Melbourne. Riêng London, số tổ ong đăng ký đã tăng hơn gấp ba từ 2008 đến 2018, và mức tăng tương tự được ghi nhận ở New York, Berlin và Tokyo.',
      'Sức hấp dẫn dễ hiểu. Nuôi ong cho cư dân thành phố một kết nối hữu hình với thiên nhiên, một lượng mật khiêm tốn và cảm giác thoả mãn vì đang làm gì đó cho môi trường. Truyền thông đưa tin về số lượng ong suy giảm đã biến ong mật thành biểu tượng của mối lo sinh thái, và nhiều người kết luận cách giúp trực tiếp nhất là tự nuôi một tổ. Các công ty cũng hưởng ứng: trại ong trên mái nay là hình ảnh quen thuộc trong báo cáo phát triển bền vững của doanh nghiệp.',
      'Tuy nhiên ngày càng nhiều nhà sinh thái cho rằng sự nhiệt tình này đặt sai chỗ. Họ chỉ ra ong mật là loài được thuần hoá, quản lý, không có nguy cơ tuyệt chủng. Những côn trùng thực sự cần giúp là loài thụ phấn hoang dã: ong đơn độc, ong nghệ, ruồi giả ong và bướm – nhiều loài đã suy giảm nghiêm trọng. Một đàn ong mật có thể tới 50.000 cá thể, mỗi con kiếm ăn trong bán kính vài km, và khi tổ ong dày đặc trong thành phố, chúng cạnh tranh với loài hoang dã cùng nguồn mật và phấn hoa hữu hạn. Một nghiên cứu ở Paris thấy rằng ở các quận có mật độ tổ ong cao nhất, số lượng ong hoang dã thấp hơn rõ rệt so với khu vực tương đương có ít tổ.',
      'Vấn đề là cung và cầu. Hoa trong thành phố là hữu hạn, và một công viên điển hình không thể nuôi vô hạn số ong kiếm ăn. Các nhà nghiên cứu ở London tính toán năm 2020 rằng các tổ ong của thủ đô sẽ cần gấp khoảng bốn lần nguồn hoa thực có nếu mọi đàn đều phát triển tốt. Sản lượng mật theo đó giảm: một số người nuôi ong lâu năm cho biết tổ của họ nay cho chưa tới một nửa lượng mật so với 15 năm trước, và họ quy trực tiếp cho tình trạng quá tải.',
      'Điều này không có nghĩa nuôi ong đô thị tự thân là ý tưởng tồi. Nếu quản lý tốt, một số ít tổ có thể chung sống với loài thụ phấn hoang dã, và nuôi ong vẫn là cách tuyệt vời để dạy về sinh thái. Vấn đề là quy mô và mục đích. Giới phê bình gợi ý ai muốn giúp loài thụ phấn nên nghĩ đến trồng cây trước khi nuôi ong. Một chậu oải hương bên cửa sổ hay một dải hoa dại làm được nhiều cho côn trùng thành phố hơn một tổ ong nữa, vì nó tăng lượng thức ăn thay vì tăng số miệng ăn cạnh tranh.',
      'Một số thành phố đã bắt đầu phản ứng. Vài quận ở Paris nay yêu cầu người muốn nuôi ong chứng minh có đủ nguồn hoa gần đó trước khi cấp phép, và cơ quan môi trường Berlin ban hành hướng dẫn khuyên cư dân không đặt tổ mới ở những khu đã bão hoà. Ở Melbourne, một liên minh vườn cộng đồng chuyển trọng tâm từ tổ ong sang "khách sạn ong" – bó thân rỗng và gỗ khoan lỗ làm nơi làm tổ cho loài ong đơn độc – cùng chương trình trồng cây thân thiện với loài thụ phấn.',
      'Liệu các biện pháp này có đảo ngược xu hướng hay không còn phải chờ xem. Hình ảnh tổ ong trên mái rất có sức mạnh, và chụp một người nuôi ong đeo mạng che dễ hơn nhiều so với chụp một vạt hoa dại. Nhưng bài học của cơn sốt nuôi ong đô thị rộng hơn thế, về hành động vì môi trường: cử chỉ dễ thấy nhất không phải lúc nào cũng hữu ích nhất, và ý tốt, dù chân thành đến đâu, không thay thế được việc hiểu hệ sinh thái thực sự vận hành ra sao.',
    ],
    vocab: [
      ['curiosity', 'n', 'thứ lạ, điều hiếm gặp', 'once a curiosity practised by a handful of enthusiasts'],
      ['mainstream', 'adj', 'phổ biến, đại chúng', 'a mainstream hobby'],
      ['tangible', 'adj', 'hữu hình, cụ thể', 'a tangible connection with nature'],
      ['embrace', 'v', 'đón nhận, hưởng ứng', 'Companies have embraced the trend'],
      ['misplaced', 'adj', 'đặt sai chỗ, không đúng', 'the enthusiasm is misplaced'],
      ['domesticated', 'adj', 'được thuần hoá', 'a managed, domesticated species'],
      ['pollinator', 'n', 'loài thụ phấn', 'wild pollinators'],
      ['forage', 'v', 'kiếm ăn', 'foraging over several kilometres'],
      ['finite', 'adj', 'hữu hạn', 'Flowers in a city are finite'],
      ['attribute A to B', 'v', 'quy A cho B', 'attribute directly to overcrowding'],
      ['coexist', 'v', 'cùng tồn tại', 'coexist with wild pollinators'],
      ['saturated', 'adj', 'bão hoà', 'already saturated neighbourhoods'],
      ['substitute for', 'n', 'thứ thay thế', 'no substitute for understanding'],
      ['gesture', 'n', 'cử chỉ, hành động mang tính biểu tượng', 'the most visible gesture'],
    ],
  },
  {
    id: 'r-sleep-memory', skill: 'reading', builtin: true, addedAt: T0 + 1, title: 'Sleep and the Making of Memories', topic: 'Science', level: 'hard', module: 'academic', minutes: 20,
    passage: `For most of the twentieth century, sleep was regarded by scientists as a period of inactivity – a nightly shutdown during which the brain simply rested. The idea that something useful might be happening while we were unconscious seemed faintly absurd. That view began to change in the 1990s, when researchers using electrodes implanted in the brains of rats made a striking discovery. Neurons that had fired in a particular sequence while a rat ran through a maze during the day fired again, in the same order, while the animal slept. The brain, it appeared, was replaying the day's experience.

This phenomenon, now called 'replay', has since been observed in humans using brain imaging, and it lies at the heart of the dominant modern theory of why we sleep. According to the consolidation hypothesis, memories are initially stored in a fragile form in a region called the hippocampus. During the deep, slow-wave stages of sleep, these memories are reactivated and gradually transferred to the neocortex, the brain's outer layer, where they are integrated with existing knowledge and become stable. Sleep, in other words, is when the brain files the day's paperwork.

The evidence supporting this account is considerable. In a well-known experiment, volunteers learned to tap a sequence of keys as quickly as possible and were tested twelve hours later. Those who slept in between improved their speed by around twenty per cent, while those who stayed awake for the same period showed no improvement at all. Other studies have found that people who nap after learning a list of word pairs recall more of them than people who do not, and that the benefit is greatest when the nap contains plenty of slow-wave sleep.

Perhaps more intriguing is the suggestion that sleep does not merely preserve memories but transforms them. Participants in one study were taught a hidden rule governing a series of number puzzles without being told that such a rule existed. After a night's sleep, more than twice as many participants discovered the rule for themselves as did after an equivalent period awake. The researchers concluded that sleep had allowed the brain to extract the underlying pattern from the individual examples – a process not unlike insight.

Not everyone is persuaded. Some neuroscientists argue that the consolidation effects, while real, are smaller than enthusiastic press coverage suggests, and that many of the key experiments used small numbers of participants. Others point out that a competing theory – that sleep's main memory-related job is to weaken unimportant connections, clearing space for new learning – explains much of the same data. On this 'synaptic homeostasis' view, the brain is not so much filing memories as pruning them, and the apparent strengthening of what remains is a side effect.

The two theories are not necessarily incompatible, and recent work suggests that both processes may operate during different stages of the night. What is not in dispute is that disrupting sleep disrupts memory. Adolescents who sleep less than seven hours perform measurably worse on tests of recall; shift workers whose sleep is fragmented show deficits in learning new tasks; and in laboratory studies, selectively waking people during slow-wave sleep, while leaving total sleep time unchanged, is enough to erase the overnight improvement on motor tasks.

The practical implications are easy to state and hard to follow. Students who revise through the night before an examination are, according to this research, undermining the very process that would have fixed the material in their minds. A shorter study session followed by a full night's sleep is, on average, a more effective strategy – advice that generations of students have received from their parents and, for the most part, ignored.`,
    groups: [
      {
        instruction: 'Choose the correct letter, A, B, C or D.',
        questions: [
          { no: 1, type: 'mcq', text: 'What did the 1990s rat experiments reveal?', options: ['Rats could remember mazes for longer if they slept.', 'The brain repeated patterns of activity from the day during sleep.', 'Sleep caused neurons to fire in random sequences.', 'Rats that ran mazes slept more deeply.'], answer: 1, explanation: '"Neurons that had fired in a particular sequence… fired again, in the same order, while the animal slept."' },
          { no: 2, type: 'mcq', text: 'According to the consolidation hypothesis, the neocortex is where memories', options: ['are first created.', 'are temporarily held.', 'become permanent.', 'are deleted.'], answer: 2, explanation: '"transferred to the neocortex… where they… become stable".' },
          { no: 3, type: 'mcq', text: 'In the key-tapping experiment, participants who stayed awake', options: ['became slightly slower.', 'improved by about 20%.', 'did not get any faster.', 'forgot the sequence.'], answer: 2, explanation: '"showed no improvement at all".' },
          { no: 4, type: 'mcq', text: 'The number-puzzle study suggested that sleep helps people to', options: ['remember individual examples.', 'solve puzzles more quickly.', 'notice a pattern they were not told about.', 'follow rules more accurately.'], answer: 2, explanation: '"extract the underlying pattern" – rule they were not told existed.' },
        ],
      },
      {
        instruction: 'Do the following statements agree with the claims of the writer? Write YES if the statement agrees with the claims of the writer, NO if the statement contradicts the claims of the writer, NOT GIVEN if it is impossible to say what the writer thinks about this.',
        questions: [
          { no: 5, type: 'ynng', text: 'Media reports have exaggerated the size of sleep\'s effect on memory.', answer: 'YES', explanation: 'Người viết thuật lại "smaller than enthusiastic press coverage suggests" như quan điểm hợp lý của một số nhà khoa học → tác giả đồng ý một phần? Chú ý: đây là ý của "some neuroscientists". Tuy nhiên tác giả trình bày như lập luận có cơ sở; đáp án theo đề là YES.' },
          { no: 6, type: 'ynng', text: 'The synaptic homeostasis theory and the consolidation theory cannot both be correct.', answer: 'NO', explanation: '"The two theories are not necessarily incompatible".' },
          { no: 7, type: 'ynng', text: 'Shift workers should be given extra sleep by their employers.', answer: 'NOT GIVEN', explanation: 'Bài chỉ nêu shift workers bị ảnh hưởng, không nói gì về việc người sử dụng lao động nên làm.' },
          { no: 8, type: 'ynng', text: 'Most students follow the advice to sleep rather than revise all night.', answer: 'NO', explanation: '"for the most part, ignored".' },
        ],
      },
      {
        instruction: 'Complete the summary below. Choose ONE WORD ONLY from the passage for each answer.', wordLimit: 'ONE WORD ONLY',
        context: 'Evidence that sleep matters for memory',
        questions: [
          { no: 9, type: 'fill', text: 'Memories are first held in a ___ state in the hippocampus.', answer: ['fragile'], explanation: '"stored in a fragile form".' },
          { no: 10, type: 'fill', text: 'Word-pair recall improves most when a nap includes a lot of ___ sleep.', answer: ['slow-wave', 'slow wave'], explanation: '"when the nap contains plenty of slow-wave sleep".' },
          { no: 11, type: 'fill', text: 'On the competing theory, the brain is ___ connections rather than filing them.', answer: ['pruning', 'weakening'], explanation: '"not so much filing memories as pruning them".' },
          { no: 12, type: 'fill', text: 'Teenagers who sleep under seven hours do worse on tests of ___.', answer: ['recall'], explanation: '"perform measurably worse on tests of recall".' },
          { no: 13, type: 'fill', text: 'Waking people during deep sleep removes the overnight gain on ___ tasks.', answer: ['motor'], explanation: '"erase the overnight improvement on motor tasks".' },
        ],
      },
    ],
    vocab: [
      ['faintly absurd', 'phr', 'hơi vô lý', 'seemed faintly absurd'],
      ['striking', 'adj', 'nổi bật, gây chú ý', 'a striking discovery'],
      ['consolidation', 'n', 'sự củng cố (trí nhớ)', 'the consolidation hypothesis'],
      ['fragile', 'adj', 'mong manh, dễ vỡ', 'a fragile form'],
      ['integrate with', 'v', 'tích hợp với', 'integrated with existing knowledge'],
      ['considerable', 'adj', 'đáng kể', 'The evidence… is considerable'],
      ['intriguing', 'adj', 'hấp dẫn, gây tò mò', 'Perhaps more intriguing'],
      ['underlying', 'adj', 'nền tảng, ẩn bên dưới', 'the underlying pattern'],
      ['persuaded', 'adj', 'bị thuyết phục', 'Not everyone is persuaded'],
      ['incompatible', 'adj', 'không tương thích', 'not necessarily incompatible'],
      ['deficit', 'n', 'sự thiếu hụt', 'deficits in learning new tasks'],
      ['undermine', 'v', 'làm suy yếu', 'undermining the very process'],
      ['implication', 'n', 'hàm ý, hệ quả', 'The practical implications'],
    ],
  },

  // ======================= LISTENING (đọc bằng giọng máy) =======================
  {
    id: 'l-s1-gym', skill: 'listening', builtin: true, addedAt: T0 + 2, title: 'Joining a sports centre', topic: 'Daily life', level: 'easy', section: 1, voice: 'en-GB',
    transcript: `Receptionist: Good morning, Riverside Sports Centre. How can I help you?
Caller: Oh, hello. I'd like some information about becoming a member, please.
Receptionist: Of course. Can I take your name first?
Caller: Yes, it's Daniel Hargreaves. That's H-A-R-G-R-E-A-V-E-S.
Receptionist: Thank you, Daniel. And could I have a contact number?
Caller: Sure. My mobile is 07700 900 416.
Receptionist: 07700 900 416. Lovely. Now, we have three types of membership. The standard membership is forty-five pounds a month and gives you access to the gym and the pool.
Caller: Does that include classes?
Receptionist: No, classes are extra with the standard package. If you want classes included, you'd need the premium membership, which is sixty pounds a month. That covers the gym, the pool, all the classes and the sauna.
Caller: Right. And the third type?
Receptionist: That's the off-peak membership. It's only thirty pounds a month, but you can only use the centre between nine in the morning and four in the afternoon on weekdays.
Caller: Hmm, I work during the day, so that won't suit me. I think the premium one sounds best, actually, because I'd like to try the yoga classes.
Receptionist: Good choice. The yoga classes are on Tuesday and Thursday evenings at half past six. Oh, and I should mention there's a one-off joining fee of twenty pounds, but we're waiving that for anyone who signs up before the end of March.
Caller: Great, that's good timing. What do I need to bring?
Receptionist: Just some photo identification – a passport or driving licence – and proof of your address, such as a recent utility bill. And we'll take a photo of you here for your membership card.
Caller: OK. Is there parking at the centre?
Receptionist: There is, but it's quite limited. Most members come by bus – the number 14 stops right outside. If you do drive, parking is free for the first two hours, and after that it's one pound fifty an hour.
Caller: I'll probably cycle, to be honest. Are there bike racks?
Receptionist: Yes, there are covered bike racks next to the main entrance.
Caller: Perfect. One more thing – can I freeze my membership if I go away?
Receptionist: Yes, you can suspend it for up to three months a year, but you need to give us at least two weeks' notice in writing. An email is fine.
Caller: That's really helpful. Thank you.
Receptionist: You're welcome. We'll see you soon, Daniel.`,
    groups: [
      {
        instruction: 'Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
        context: 'RIVERSIDE SPORTS CENTRE – Membership enquiry',
        questions: [
          { no: 1, type: 'fill', text: 'Name: Daniel ___', answer: ['Hargreaves'], explanation: 'Tên được đánh vần H-A-R-G-R-E-A-V-E-S.' },
          { no: 2, type: 'fill', text: 'Mobile: 07700 ___', answer: ['900416', '900 416'], explanation: '"07700 900 416".' },
          { no: 3, type: 'fill', text: 'Standard membership: £___ per month', answer: ['45'], explanation: '"forty-five pounds a month".' },
          { no: 4, type: 'fill', text: 'Premium membership includes gym, pool, classes and ___', answer: ['sauna', 'the sauna'], explanation: '"all the classes and the sauna".' },
          { no: 5, type: 'fill', text: 'Off-peak membership: weekdays 9 am – ___ pm only', answer: ['4'], explanation: '"between nine in the morning and four in the afternoon".' },
          { no: 6, type: 'fill', text: 'Yoga classes: Tuesday and ___ evenings', answer: ['Thursday'], explanation: '"Tuesday and Thursday evenings".' },
        ],
      },
      {
        instruction: 'Choose the correct letter, A, B or C.',
        questions: [
          { no: 7, type: 'mcq', text: 'The joining fee is', options: ['£20 for everyone.', 'free for people joining before April.', 'included in the monthly price.'], answer: 1, explanation: '"waiving that for anyone who signs up before the end of March".' },
          { no: 8, type: 'mcq', text: 'Which document must Daniel bring?', options: ['a bank statement', 'a utility bill', 'a birth certificate'], answer: 1, explanation: '"proof of your address, such as a recent utility bill". Hộ chiếu/bằng lái là photo ID, nhưng lựa chọn chỉ có utility bill.' },
          { no: 9, type: 'mcq', text: 'How does Daniel plan to travel to the centre?', options: ['by bus', 'by car', 'by bicycle'], answer: 2, explanation: '"I\'ll probably cycle" – bẫy: bus 14 và parking chỉ là thông tin.' },
          { no: 10, type: 'mcq', text: 'To freeze his membership, Daniel must', options: ['give two weeks\' written notice.', 'pay a small fee.', 'visit the centre in person.'], answer: 0, explanation: '"at least two weeks\' notice in writing".' },
        ],
      },
    ],
    vocab: [
      ['waive (a fee)', 'v', 'miễn (phí)', "we're waiving that"],
      ['one-off', 'adj', 'một lần duy nhất', 'a one-off joining fee'],
      ['off-peak', 'adj', 'ngoài giờ cao điểm', 'off-peak membership'],
      ['proof of address', 'n', 'giấy tờ chứng minh địa chỉ'],
      ['suspend', 'v', 'tạm dừng', 'suspend it for up to three months'],
      ['notice', 'n', 'thông báo trước', "two weeks' notice"],
    ],
  },
  {
    id: 'l-s4-coffee', skill: 'listening', builtin: true, addedAt: T0 + 3, title: 'Lecture: The history of coffee houses', topic: 'History', level: 'hard', section: 4, voice: 'en-GB',
    transcript: `Good afternoon everyone. Today I want to talk about the coffee house – not the modern chain café, but its ancestor, the coffee house of the seventeenth and eighteenth centuries – and to argue that it played a surprisingly important role in the development of modern business and science.
Coffee itself reached Europe through trade with the Ottoman Empire. The first coffee house in England opened in Oxford in 1650, and the first in London followed two years later, in 1652. Within half a century there were, by some estimates, more than two thousand coffee houses in London alone – a remarkable number for a city of around six hundred thousand people.
Why were they so popular? Partly, of course, because of the drink. Before coffee, the usual daytime drink in England was weak beer, because water was often unsafe. Coffee, by contrast, was stimulating rather than intoxicating, and contemporaries noticed the difference. One writer described coffee houses as places where 'people grew sober, and wise'.
But the real attraction was social. For the price of a cup – typically one penny – anyone could sit for as long as he liked, read the newspapers that the house provided, and join in conversation with whoever happened to be there. For this reason coffee houses were nicknamed 'penny universities'. Unlike taverns, there was no requirement to keep buying drinks, and unlike private clubs, there was no membership. Rank mattered less than elsewhere: a merchant, a clergyman and a poet might share a table.
Now, this openness had consequences. Because people with similar interests tended to gather in the same houses, each house developed its own character. Scientists met at the Grecian, near the Royal Society. Writers gathered at Will's in Covent Garden. And, most significantly for my argument, merchants and ship-owners gathered at a house on Tower Street run by a man named Edward Lloyd.
Lloyd realised that his customers wanted reliable information about ships: when they had sailed, when they were expected, which had been lost. So from around 1696 he began publishing a news-sheet – Lloyd's List – containing exactly this information. Underwriters, people who insured ships and cargo, naturally came to Lloyd's to read it, and they began doing business at its tables. That informal market eventually became Lloyd's of London, which is still one of the world's major insurance markets today. A similar story can be told about Jonathan's coffee house in Exchange Alley, where stockbrokers who had been expelled from the Royal Exchange for rowdiness began trading. Jonathan's became, in time, the London Stock Exchange.
Science benefited too. The Royal Society's members often continued their discussions in coffee houses, and some lectures on experimental philosophy were actually delivered in them, to paying audiences. One historian has described the coffee house as 'the internet of the Enlightenment' – a network through which news, ideas and gossip travelled faster than ever before.
Not everyone approved. In 1675 King Charles the Second tried to close the coffee houses altogether, claiming they were centres of idleness and political disaffection. The protest was so great that he withdrew the order within eleven days. More enduring was the opposition of women, who were largely excluded from coffee houses and who complained, in a famous pamphlet of 1674, that their husbands spent all day there talking rather than working.
Why did the coffee house decline? Several reasons. Tea became cheaper and more fashionable in the eighteenth century, and was drunk at home. The informal institutions that had grown up in coffee houses – the insurance market, the stock exchange – moved into premises of their own. And the gentlemen's club, with its restricted membership, offered the wealthy a more exclusive alternative. By 1800 the coffee house as a public forum had largely disappeared.
So, to summarise: the coffee house mattered not because of coffee, but because it was a cheap, open space where information could be exchanged. Next week we'll look at a comparable institution in a different setting – the Parisian salon.`,
    groups: [
      {
        instruction: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.', wordLimit: 'ONE WORD AND/OR A NUMBER',
        context: 'The early coffee house',
        questions: [
          { no: 1, type: 'fill', text: 'First English coffee house: ___, 1650', answer: ['Oxford'], explanation: '"The first coffee house in England opened in Oxford in 1650".' },
          { no: 2, type: 'fill', text: 'London had over ___ coffee houses by about 1700', answer: ['2000', '2,000', 'two thousand'], explanation: '"more than two thousand coffee houses".' },
          { no: 3, type: 'fill', text: 'Usual daytime drink before coffee: weak ___', answer: ['beer'], explanation: '"the usual daytime drink in England was weak beer".' },
          { no: 4, type: 'fill', text: 'Price of a cup: one ___', answer: ['penny'], explanation: '"typically one penny".' },
          { no: 5, type: 'fill', text: 'Nickname: "penny ___"', answer: ['universities', 'university'], explanation: '"nicknamed \'penny universities\'".' },
        ],
      },
      {
        instruction: 'Which coffee house is associated with each group? Choose the correct letter, A–D.',
        bank: ['the Grecian', "Will's", "Lloyd's", "Jonathan's"],
        questions: [
          { no: 6, type: 'match', text: 'scientists', answer: 0, explanation: '"Scientists met at the Grecian".' },
          { no: 7, type: 'match', text: 'ship-owners', answer: 2, explanation: '"merchants and ship-owners gathered at… Edward Lloyd".' },
          { no: 8, type: 'match', text: 'stockbrokers', answer: 3, explanation: '"Jonathan\'s… stockbrokers… began trading".' },
        ],
      },
      {
        instruction: 'Choose the correct letter, A, B or C.',
        questions: [
          { no: 9, type: 'mcq', text: 'Why did King Charles II cancel his order to close coffee houses?', options: ['The coffee house owners paid him.', 'There was strong public opposition.', 'Parliament refused to support it.'], answer: 1, explanation: '"The protest was so great that he withdrew the order within eleven days".' },
          { no: 10, type: 'mcq', text: 'According to the lecturer, the main reason coffee houses mattered was that they', options: ['served a healthier drink than beer.', 'allowed cheap, open exchange of information.', 'were where the Royal Society was founded.'], answer: 1, explanation: 'Phần tóm tắt: "a cheap, open space where information could be exchanged".' },
        ],
      },
    ],
    vocab: [
      ['ancestor', 'n', 'tổ tiên, tiền thân', 'its ancestor'],
      ['stimulating', 'adj', 'kích thích (tinh thần)', 'stimulating rather than intoxicating'],
      ['intoxicating', 'adj', 'gây say', ''],
      ['rank', 'n', 'địa vị, thứ bậc', 'Rank mattered less'],
      ['underwriter', 'n', 'người bảo hiểm', 'Underwriters, people who insured ships'],
      ['expel', 'v', 'trục xuất', 'expelled from the Royal Exchange'],
      ['disaffection', 'n', 'sự bất mãn', 'political disaffection'],
      ['enduring', 'adj', 'lâu dài', 'More enduring was the opposition'],
      ['premises', 'n', 'cơ sở, toà nhà', 'premises of their own'],
      ['exclusive', 'adj', 'dành riêng, chọn lọc', 'a more exclusive alternative'],
    ],
  },

  // ======================= SPEAKING =======================
  {
    id: 's-hometown', skill: 'speaking', builtin: true, addedAt: T0 + 4, title: 'Hometown · A place you like to visit · Cities and countryside', topic: 'Places',
    part1: [
      { topic: 'Hometown', questions: ['Where is your hometown?', 'What do you like most about it?', 'Has it changed much since you were a child?', 'Would you like to live there in the future?'],
        samples: ["I'm from Da Nang, which is a coastal city in central Vietnam, roughly halfway between Hanoi and Ho Chi Minh City. It's known for its beaches and the mountains nearby.", "Probably the pace of life. It's big enough to have everything you need, but it's nowhere near as hectic as Hanoi, and you're never more than ten minutes from the sea.", "Enormously. When I was small it was quite a sleepy place, but over the last decade there's been a construction boom – new bridges, hotels along the beach, and a lot more tourists.", "I think so, at least in the long run. I'd like to work abroad for a few years first, but I can imagine settling down there eventually."] },
      { topic: 'Weekends', questions: ['What do you usually do at the weekend?', 'Do you prefer to stay at home or go out?', 'Is there anything you would like to do at the weekend but can\'t?'],
        samples: ["It varies, but typically I catch up on sleep on Saturday morning, then meet friends for coffee or play badminton in the afternoon.", "It depends on how my week has been. If work has been exhausting I'm happy to stay in with a book, but generally I'd rather be out doing something.", "I'd love to go hiking more often, but the nearest decent trails are a couple of hours away, so it's hard to fit in."] },
    ],
    part2: { topic: 'A place you like to visit', cue: 'Describe a place you like to visit but do not want to live in.', points: ['where it is', 'how you first went there', 'what you do when you are there', 'and explain why you would not want to live there'],
      followUp: ['Do your friends like this place too?'],
      sample: "The place I'd like to talk about is Hoi An, an old trading town about thirty kilometres south of where I live. I first went there on a school trip when I was about twelve, and I've been back probably a dozen times since.\n\nWhat I usually do is quite simple: I wander round the old quarter in the early morning before the tour groups arrive, when the yellow walls catch the light and the only people around are shopkeepers putting out their stalls. Then I'll have a bowl of cao lầu, which is a noodle dish you can't really get anywhere else, and in the evening I'll sit by the river watching the lanterns. It's incredibly photogenic, and there's a sort of slow rhythm to the place that I find really restful.\n\nHaving said that, I wouldn't want to live there, for a couple of reasons. The first is that it's essentially a tourist town now – almost every building in the centre is a café, a tailor's or a souvenir shop, and I think it would feel a bit like living in a museum. The second is practical: there aren't many jobs in my field, and the town floods badly most autumns. So it's the perfect place for a weekend, but I'm quite happy to drive home afterwards." },
    part3: { questions: ['Why do some people prefer living in the countryside?', 'What are the disadvantages of living in a big city?', 'Do you think cities will continue to grow in the future?', 'How can governments make cities more pleasant to live in?', 'Is it better for children to grow up in a city or in the countryside?'],
      samples: ["I think the main draw is the quality of life – cleaner air, less noise, and a stronger sense of community. People also tend to have more space, which matters a lot if you have children or want a garden. Having said that, it often comes at the cost of fewer job opportunities.", "The obvious ones are congestion and the cost of living. In Ho Chi Minh City, for example, people can easily spend two hours a day commuting, and rents have risen much faster than wages. There's also a more subtle issue, which is that city life can be surprisingly isolating despite being surrounded by millions of people.", "On balance, yes, at least in developing countries, because that's where the jobs are. But I suspect the growth will be in mid-sized cities rather than the megacities, partly because remote working has made it possible to live somewhere cheaper without sacrificing your career.", "Investment in public transport is probably the single most effective thing, because it tackles congestion, pollution and inequality at the same time. Beyond that, protecting green space and enforcing building regulations so that developers don't simply fill every gap with apartment blocks.", "There's no simple answer. Cities offer better schools and more cultural opportunities, whereas the countryside offers freedom and safety. Personally I'd lean towards the city for teenagers, who need stimulation, but the countryside for younger children."] },
    vocab: [
      ['hectic', 'adj', 'bận rộn, hối hả', 'nowhere near as hectic as Hanoi'],
      ['construction boom', 'n', 'bùng nổ xây dựng'],
      ['settle down', 'v', 'ổn định cuộc sống'],
      ['photogenic', 'adj', 'ăn ảnh'],
      ['restful', 'adj', 'thư thái, yên tĩnh'],
      ['the main draw', 'n', 'điểm thu hút chính'],
      ['congestion', 'n', 'tắc nghẽn'],
      ['isolating', 'adj', 'gây cô lập'],
      ['on balance', 'phr', 'xét tổng thể'],
      ['lean towards', 'v', 'nghiêng về'],
    ],
  },
  {
    id: 's-technology', skill: 'speaking', builtin: true, addedAt: T0 + 5, title: 'Phones · A useful app · Technology and society', topic: 'Technology',
    part1: [
      { topic: 'Mobile phones', questions: ['How often do you use your mobile phone?', 'What do you mainly use it for?', 'Do you think you spend too much time on your phone?'],
        samples: ["Honestly, constantly – it's the first thing I look at in the morning and the last thing at night. I'd estimate four or five hours a day, which I'm not proud of.", "Mostly messaging and social media, but also for work – I check email and join meetings on it when I'm travelling. And maps; I'd be lost without the maps.", "Yes, definitely. I've started putting it in another room in the evenings because otherwise I find myself scrolling without really meaning to."] },
    ],
    part2: { topic: 'A useful app', cue: 'Describe an app on your phone that you find useful.', points: ['what the app is', 'how you found out about it', 'how you use it', 'and explain why you find it useful'],
      sample: "I'd like to talk about a language-learning app that I've been using for about two years now to keep up my English vocabulary. A colleague recommended it when I mentioned I was planning to take IELTS; she'd used it for Japanese and swore by it.\n\nThe way it works is based on spaced repetition – you save words you come across while reading, and the app shows them to you again just before you're about to forget them. I use it mostly on my commute: I'll read an article in English on the bus, tap any word I don't know, and then review the cards the app has made for me. It takes maybe fifteen minutes a day.\n\nThe reason I find it so useful is that it turned something I'd always found tedious – memorising vocabulary – into a habit that I barely notice. I've learnt something like three thousand words this way, and more importantly I actually remember them, because I always see them in the sentence where I first found them rather than in a list. If I had to pick one app to keep, it would probably be that one." },
    part3: { questions: ['How has technology changed the way people communicate?', 'Are there any disadvantages to children using smartphones?', 'Do you think people rely too much on technology?', 'What technological developments do you expect to see in the next twenty years?'],
      samples: ["Fundamentally, I'd say. Communication used to be either face-to-face or quite effortful – a letter or an expensive phone call – whereas now it's instant and essentially free, which means we stay in touch with far more people, though arguably more superficially.", "Several, I think. The most discussed is the effect on attention and sleep, but I'd also mention that children miss out on boredom, which sounds odd but is actually where a lot of creativity comes from. That said, banning phones entirely seems unrealistic.", "In some ways, yes. Most people can't navigate a city without GPS or remember phone numbers anymore. But I'm not sure that's necessarily a problem – we've always outsourced skills to tools, and freeing up mental energy for other things is arguably the point.", "I'd expect artificial intelligence to be woven into almost everything, in the way electricity is now – invisible but everywhere. In healthcare particularly, I imagine diagnosis will be far more automated. Whether that's entirely positive is another question."] },
    vocab: [
      ['swear by sth', 'v', 'rất tin dùng', "she swore by it"],
      ['spaced repetition', 'n', 'lặp lại ngắt quãng'],
      ['tedious', 'adj', 'tẻ nhạt'],
      ['superficially', 'adv', 'một cách hời hợt'],
      ['miss out on', 'v', 'bỏ lỡ'],
      ['outsource', 'v', 'thuê ngoài, giao cho bên khác'],
      ['woven into', 'phr', 'đan xen vào'],
    ],
  },

  // ======================= WRITING =======================
  {
    id: 'w-t1-line', skill: 'writing', builtin: true, addedAt: T0 + 6, title: 'Task 1 – Line graph: Internet users by region', topic: 'Technology', task: 1, module: 'academic', type: 'line',
    prompt: 'The graph below shows the percentage of the population using the internet in four regions between 2005 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    chart: { kind: 'line', unit: '% of population', labels: ['2005', '2010', '2015', '2020'], series: [{ name: 'Europe', values: [46, 67, 76, 87] }, { name: 'Asia', values: [9, 23, 38, 59] }, { name: 'Latin America', values: [17, 35, 55, 71] }, { name: 'Africa', values: [2, 10, 22, 43] }] },
    outline: ['Mở bài: paraphrase đề (proportion of people online, four regions, 2005–2020).', 'Overview: tất cả đều tăng; Europe cao nhất suốt kỳ; Africa thấp nhất nhưng tăng nhanh nhất về tỉ lệ; khoảng cách thu hẹp.', 'Đoạn 1: Europe và Latin America – số liệu đầu/cuối, so sánh.', 'Đoạn 2: Asia và Africa – xuất phát thấp, tăng mạnh sau 2010.'],
    sample: `The line graph illustrates the proportion of people who used the internet in Europe, Asia, Latin America and Africa over a fifteen-year period from 2005 to 2020.

Overall, internet use rose substantially in all four regions. Europe remained the region with the highest level of access throughout, whereas Africa, despite starting from a very low base, recorded the fastest relative growth, so the gap between the regions narrowed considerably by the end of the period.

In 2005, just under half of Europeans (46%) were online, far ahead of any other region. This figure climbed steadily to 67% in 2010 and reached 87% by 2020. Latin America followed a similar upward trend but from a lower starting point: internet use there stood at only 17% in 2005, before more than quadrupling to 71% in 2020.

Asia and Africa began the period with very limited access, at 9% and 2% respectively. Growth in both regions was initially modest but accelerated after 2010. By 2020, almost three in five people in Asia (59%) were using the internet, while in Africa the proportion had risen to 43%, more than twenty times its 2005 level.`,
    vocab: [['proportion', 'n', 'tỉ lệ'], ['from a low base', 'phr', 'từ mức xuất phát thấp'], ['narrow (the gap)', 'v', 'thu hẹp (khoảng cách)'], ['quadruple', 'v', 'tăng gấp bốn'], ['respectively', 'adv', 'lần lượt'], ['accelerate', 'v', 'tăng tốc'], ['modest', 'adj', 'khiêm tốn, nhỏ']],
  },
  {
    id: 'w-t1-process', skill: 'writing', builtin: true, addedAt: T0 + 7, title: 'Task 1 – Process: Recycling glass bottles', topic: 'Environment', task: 1, module: 'academic', type: 'process',
    prompt: 'The diagram below shows the process of recycling glass bottles.\n\nStages: (1) used bottles collected from collection points → (2) transported to a recycling plant → (3) bottles washed with high-pressure water → (4) sorted by colour (clear / green / brown) → (5) crushed into small pieces called cullet → (6) cullet melted in a furnace at 600–800 °C → (7) molten glass poured into moulds to form new bottles → (8) new bottles filled, delivered to shops and sold.\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.',
    outline: ['Mở bài: paraphrase – how glass bottles are recycled.', 'Overview: a cyclical/linear process with eight stages, beginning with collection and ending with sale of new bottles; three main phases: collection, processing, manufacturing.', 'Đoạn 1: giai đoạn 1–4 (collection → washing → sorting), dùng bị động.', 'Đoạn 2: giai đoạn 5–8 (crushing → melting → moulding → sale), từ nối trình tự.'],
    sample: `The diagram illustrates how used glass bottles are recycled and turned into new ones. Overall, the process is cyclical and consists of eight stages, which can be divided into three main phases: collection, processing of the glass, and manufacturing and distribution of new bottles.

The cycle begins when empty bottles are deposited at collection points, from where they are transported by lorry to a recycling plant. On arrival, the bottles are cleaned using high-pressure water to remove labels and residue. They are then sorted according to colour into three categories: clear, green and brown glass.

Once sorted, the bottles are crushed into small fragments, known as cullet. This cullet is fed into a furnace and heated to a temperature of between 600 and 800 degrees Celsius until it melts. The resulting molten glass is subsequently poured into moulds, where it is shaped into new bottles. In the final stage, the bottles are filled with products, delivered to shops and sold to consumers, after which the cycle can begin again.`,
    vocab: [['cyclical', 'adj', 'có tính chu kỳ'], ['deposit', 'v', 'bỏ vào, gửi'], ['residue', 'n', 'cặn, chất còn lại'], ['fragment', 'n', 'mảnh vụn'], ['molten', 'adj', 'nóng chảy'], ['subsequently', 'adv', 'sau đó']],
  },
  {
    id: 'w-t2-opinion', skill: 'writing', builtin: true, addedAt: T0 + 8, title: 'Task 2 – Opinion: University education should be free', topic: 'Education', task: 2, module: 'academic', type: 'opinion',
    prompt: 'Some people believe that university education should be free for all students, regardless of their financial situation.\n\nTo what extent do you agree or disagree?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.',
    outline: ['Mở bài: paraphrase + thesis rõ ràng (partly agree: free for those who cannot pay, but not universally).', 'Thân 1: lợi ích của giáo dục miễn phí – công bằng cơ hội, lợi ích xã hội (ví dụ Đức/Bắc Âu).', 'Thân 2: vấn đề của miễn phí toàn bộ – gánh nặng ngân sách, trợ cấp cho người giàu, giảm giá trị lựa chọn; giải pháp means-tested.', 'Kết: khẳng định lại quan điểm.'],
    sample: `The question of who should pay for higher education is contested in almost every country. While some argue that universities should charge no fees whatsoever, I believe that free tuition should be targeted at those who cannot afford to pay rather than offered universally.

There are strong arguments for removing financial barriers to university. The most compelling is fairness: when tuition is expensive, talented students from poorer families are either deterred from applying or burdened with debt that shapes their choices for decades. Countries such as Germany, which abolished fees in 2014, have seen no decline in quality and a modest rise in participation among lower-income groups. Society also benefits, since graduates tend to earn more, pay more tax and contribute to innovation, so public investment in education is partly repaid.

However, making university free for everyone is a blunt instrument. Students from wealthy families, who would attend regardless, receive a subsidy they do not need, and the cost is borne by taxpayers, many of whom never went to university themselves. In England, for example, the abolition of fees would cost an estimated ten billion pounds a year – money that could instead fund early-years education, where the returns are arguably higher. There is also a risk that free places lead to governments capping student numbers, as happened in Scotland, which ironically reduces access.

A more sensible approach is a means-tested system in which tuition is free for students from low-income households and partially subsidised for others, combined with income-contingent loans that are repaid only once graduates earn above a certain threshold.

In conclusion, although I support the principle that nobody should be prevented from studying by a lack of money, I disagree that university should be free for all, because targeted support achieves the same goal at a far lower cost.`,
    vocab: [['contested', 'adj', 'gây tranh cãi'], ['deter', 'v', 'ngăn cản, làm nản lòng'], ['burden with', 'v', 'tạo gánh nặng'], ['blunt instrument', 'n', 'công cụ thô (không tinh chỉnh)'], ['subsidy', 'n', 'trợ cấp'], ['means-tested', 'adj', 'xét theo thu nhập'], ['threshold', 'n', 'ngưỡng']],
  },
  {
    id: 'w-t2-discussion', skill: 'writing', builtin: true, addedAt: T0 + 9, title: 'Task 2 – Discussion: Working from home', topic: 'Work', task: 2, module: 'academic', type: 'discussion',
    prompt: 'Some people think that working from home benefits both employees and employers. Others believe that it harms productivity and company culture.\n\nDiscuss both these views and give your own opinion.\n\nWrite at least 250 words.',
    outline: ['Mở bài: paraphrase hai quan điểm + nêu ý kiến riêng.', 'Thân 1: lợi ích – không phải đi lại, cân bằng cuộc sống, công ty tiết kiệm văn phòng, tuyển người ở xa.', 'Thân 2: tác hại – khó hợp tác tự phát, người mới khó hoà nhập, ranh giới công việc/đời sống mờ.', 'Kết: mô hình kết hợp (hybrid) là hợp lý nhất.'],
    vocab: [['commute', 'n/v', 'đi lại giữa nhà và nơi làm'], ['overheads', 'n', 'chi phí cố định'], ['spontaneous', 'adj', 'tự phát'], ['blur the line', 'v', 'làm mờ ranh giới'], ['hybrid', 'adj', 'kết hợp'], ['cohesion', 'n', 'sự gắn kết']],
  },
  {
    id: 'w-gt-letter', skill: 'writing', builtin: true, addedAt: T0 + 10, title: 'GT Task 1 – Formal letter: Complaint about a course', topic: 'Education', task: 1, module: 'general', type: 'letter-formal',
    prompt: 'You recently attended an evening course at a local college, but you were not satisfied with it.\n\nWrite a letter to the college principal. In your letter:\n• say which course you attended and when\n• explain what you were unhappy about\n• say what you would like the college to do\n\nWrite at least 150 words. Begin your letter: Dear Sir or Madam,',
    outline: ['Mở: lý do viết thư + tên khoá, thời gian.', 'Đoạn 2: vấn đề cụ thể (2–3 ý: giảng viên vắng, tài liệu, phòng học).', 'Đoạn 3: yêu cầu (hoàn tiền một phần / học lại).', 'Kết: formal closing – Yours faithfully.'],
    sample: `Dear Sir or Madam,

I am writing to express my dissatisfaction with the Introduction to Digital Photography course, which I attended at Westfield College on Tuesday evenings from 14 January to 18 March this year.

When I enrolled, the course description promised twelve sessions of practical instruction with no more than ten students per class. In reality, two of the sessions were cancelled at short notice and were never rescheduled, and the class contained nineteen students, which meant the tutor was unable to give individual feedback. In addition, the darkroom advertised in the brochure was out of order for the entire term, so the printing module could not be taught at all.

Given that a significant part of the advertised content was not delivered, I would ask that the college refund half of the £240 fee. Alternatively, I would be willing to accept a free place on the next intermediate course, provided that the darkroom has been repaired by then.

I look forward to your reply within the next fourteen days.

Yours faithfully,
Nguyen Minh Anh`,
    vocab: [['dissatisfaction', 'n', 'sự không hài lòng'], ['enrol', 'v', 'đăng ký học'], ['at short notice', 'phr', 'báo gấp'], ['out of order', 'phr', 'hỏng, không hoạt động'], ['refund', 'v/n', 'hoàn tiền'], ['provided that', 'conj', 'với điều kiện']],
  },
];
