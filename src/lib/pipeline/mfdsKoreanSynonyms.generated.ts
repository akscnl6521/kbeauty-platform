/**
 * **자동 생성 파일 — 손으로 고치지 않는다.**
 *
 * 만든 것: `scripts/build-mfds-korean-synonyms.ts`
 * 출처: 식약처 «화장품 원료성분정보» 공개 API
 *
 * 우리 성분 사전의 **영문명**(기호·대소문자를 지운 키)에 대해, 식약처가 쓰는
 * 한글 표기 중 우리 `name_ko` 와 다른 것들을 모았다. 국내몰 전성분은 이 표기로
 * 적혀 오는 일이 많아서, 이게 없으면 «성분이 사전에 없다» 로 잘못 판정된다.
 *
 * 다시 만들려면: npm run build:mfds-ko-synonyms
 */
export const MFDS_KOREAN_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  "12hexanediol": ["1,2-헥산다이올"],
  "acrylatesc1030alkylacrylatecrosspolymer": ["아크릴레이트/C10-30알킬아크릴레이트크로스폴리머"],
  "beevenom": ["벌독"],
  "betaglucan": ["베타-글루칸"],
  "camelliasinensisleafextract": ["홍차추출물", "보이차추출물", "흑차추출물", "황차추출물", "백차추출물"],
  "camelliasinensisleafwater": ["홍차수"],
  "glycyrrhizaglabralicoricerootextract": ["스페인감초뿌리추출물"],
  "hyaluronicacid": ["하이알루로닉애씨드"],
  "hydrogenatedpolyc614olefin": ["하이드로제네이티드폴리(C6-14올레핀)"],
  "lactobacilluspanaxginsengrootfermentfiltrate": ["락토바실러스/인삼뿌리발효여과물"],
  "maminophenol": ["m-아미노페놀"],
  "oryzasativaricebranextract": ["흑미강추출물"],
  "oryzasativariceextract": ["흑미추출물", "녹미추출물"],
  "paminophenol": ["p-아미노페놀"],
  "panaxginsengrootextract": ["산양삼추출물", "흑삼추출물"],
  "pentaerythrityltetraditbutylhydroxyhydrocinnamate": ["펜타에리스리틸테트라-다이-t-부틸하이드록시하이드로신나메이트"],
  "polyacrylate13": ["폴리아크릴레이트-13"],
  "polyglyceryl10laurate": ["폴리글리세릴-10라우레이트"],
  "polyglyceryl3methylglucosedistearate": ["폴리글리세릴-3메틸글루코오스다이스테아레이트"],
  "polysilicone11": ["폴리실리콘-11"],
  "pphenylenediamine": ["p-페닐렌디아민"],
  "salicylicacid": ["살리실릭애씨드"],
  "smilaxglabrarootextract": ["중국토복령추출물"],
  "snailsecretionfiltrate": ["달팽이점액여과물"],
  "titaniumdioxideci77891": ["티타늄디옥사이드"],
  "zinc": ["아연"],
  "zingiberofficinalegingerrootextract": ["생강추출물"],
};
