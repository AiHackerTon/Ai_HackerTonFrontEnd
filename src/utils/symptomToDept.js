export function symptomToDept(text) {
  const t = (text || "").normalize("NFKC");
  if (/(두통|머리|편두통|지끈|어지럽)/.test(t)) return "신경과";
  if (/(기침|감기|열|오한|가래|호흡)/.test(t)) return "내과";
  if (/(눈|시력|충혈|눈꼽|시야)/.test(t)) return "안과";
  if (/(허리|무릎|어깨|관절|삐|뼈|통증)/.test(t)) return "정형외과";
  if (/(귀|코막힘|목아픔|인후|이명)/.test(t)) return "이비인후과";
  if (/(가슴|심장|흉통|두근)/.test(t)) return "심장내과";
  if (/(복통| 속| 소화|위|장)/.test(t)) return "소화기내과";
  return "내과";
}
