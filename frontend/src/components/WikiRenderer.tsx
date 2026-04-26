import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WikiRendererProps {
  content: string;
}

export function WikiRenderer({ content }: WikiRendererProps) {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-code prose-pre:border prose-pre:border-line prose-pre:rounded-xl prose-pre:p-4 prose-code:text-accent prose-code:bg-white/5 prose-code:rounded prose-code:px-1.5 prose-h1:text-3xl prose-h1:font-display prose-h1:mb-6 prose-h2:text-2xl prose-h2:font-display prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:font-display prose-h3:mt-6 prose-h3:mb-3 prose-a:text-accent hover:prose-a:underline prose-table:w-full prose-table:border-collapse prose-th:bg-white/5 prose-th:p-3 prose-th:text-left prose-th:text-text-0 prose-th:font-semibold prose-td:p-3 prose-td:border-t prose-td:border-line prose-td:text-text-1 prose-img:rounded-xl prose-img:border prose-img:border-line prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-white/5 prose-blockquote:rounded-r-xl prose-blockquote:px-4 prose-blockquote:py-3 prose-li:text-text-1 prose-li:marker:text-text-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
