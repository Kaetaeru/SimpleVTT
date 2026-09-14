/** Node test loader: a stylesheet import resolves to an empty module, so screen modules load outside Vite. */
export async function load(url,context,nextLoad) {
  if(url.endsWith(".css")) return {format:"module",source:"export default {};",shortCircuit:true};
  return nextLoad(url,context);
}
