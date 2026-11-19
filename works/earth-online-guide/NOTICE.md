# Sources

**Chinese texts.** Base text: the character-by-character transcriptions of the Sibu Congkan and Siku Quanshu editions in the Kanseki Repository (Kanripo, https://www.kanripo.org). Punctuation and paragraphing: a widely used punctuated edition (the Daizhige corpus), aligned to the base text character by character; where the two differ, the base text wins. The works themselves are in the public domain. The scripts that did the collation are in `data-pipeline/`.

**English translations (public domain).**
- Tao Te Ching, Zhuangzi: James Legge (1891), from the Standard Ebooks editions.
- The Art of War: Lionel Giles (1910), from the Standard Ebooks edition.

Shan Hai Jing, Huangdi Neijing, I Ching and the Shiji chapters have no English here. When the page is opened inside Claude it can translate a chapter on request; that English is an unreviewed machine translation and the app labels it so.

**Narration.** The files in `audio/` were synthesized with Kokoro-82M (Apache-2.0, https://huggingface.co/hexgrad/Kokoro-82M) through kokoro-onnx. They are not recordings of any person.

**Illustrations and animation** are drawn in code inside `index.html`. No image files, fonts or third-party scripts are loaded.

**Code** (`index.html`, `data-pipeline/`, `test/`): MIT, see LICENSE.
