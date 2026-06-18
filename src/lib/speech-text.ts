export function prepareTextForSpeech(text: string): string {
  return text
    .replace(/\$/g, " dollars ")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/\be\.g\.\b/gi, "for example")
    .replace(/\bi\.e\.\b/gi, "that is")
    .replace(/\betc\.\b/gi, "and so on")
    .replace(/\s+/g, " ")
    .trim();
}
