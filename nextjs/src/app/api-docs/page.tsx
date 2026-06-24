"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif font-bold text-3xl text-white tracking-tight">
          API Documentation
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Interactive reference for all German Law Vault API endpoints
        </p>
      </div>
      <div className="glass-panel border-white/5 overflow-hidden rounded-xl [&_.swagger-ui]:!bg-transparent [&_.swagger-ui_.info]:!hidden [&_.swagger-ui_.scheme-container]:!bg-transparent [&_.swagger-ui_.scheme-container]:!shadow-none [&_.swagger-ui_.opblock-tag]:!text-white [&_.swagger-ui_.opblock-tag]:!font-serif [&_.swagger-ui_.opblock-tag]:!text-lg [&_.swagger-ui_.opblock-tag-no-url-section]:!text-white [&_.swagger-ui_.opblock]:!border-white/5 [&_.swagger-ui_.opblock]:!rounded-lg [&_.swagger-ui_.opblock-summary]:!border-white/5 [&_.swagger-ui_.opblock-summary-method]:!text-[10px] [&_.swagger-ui_.opblock-summary-method]:!font-bold [&_.swagger-ui_.opblock-summary-method]:!uppercase [&_.swagger-ui_.opblock-summary-method]:!tracking-widest [&_.swagger-ui_.opblock-summary-path]:!text-zinc-300 [&_.swagger-ui_.opblock-summary-description]:!text-zinc-500 [&_.swagger-ui_.opblock-body]:!bg-black/40 [&_.swagger-ui_.opblock-body]:!border-white/5 [&_.swagger-ui_.table-container]:!pt-0 [&_.swagger-ui_.btn]:!text-[10px] [&_.swagger-ui_.btn]:!font-bold [&_.swagger-ui_.btn]:!uppercase [&_.swagger-ui_.btn]:!tracking-widest [&_.swagger-ui_.btn]:!rounded-lg [&_.swagger-ui_ button.btn.execute]:!bg-accent-gold [&_.swagger-ui_ button.btn.execute]:!text-black [&_.swagger-ui_.responses-inner]:!bg-black/20 [&_.swagger-ui_.response-col_status]:!text-zinc-300 [&_.swagger-ui_.response-col_description]:!text-zinc-400 [&_.swagger-ui_.model-box]:!bg-black/20 [&_.swagger-ui_.model-box]:!rounded-lg [&_.swagger-ui_.model]:!text-zinc-300 [&_.swagger-ui_ .prop-type]:!text-accent-gold [&_.swagger-ui_ table]:!mb-0">
        <SwaggerUI
          url="/api/openapi"
          docExpansion="list"
          filter={true}
          defaultModelsExpandDepth={1}
        />
      </div>
    </div>
  );
}
