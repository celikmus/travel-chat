import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function renderLandmark(location: string, url: string, info: string) {
  return <div className="dark:text-gray-900 text-gray-100 p-2">
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger><Image src={url} width={100} height={100} alt={`A landmark from ${location}`}
                               style={{
                                 float: 'left',
                                 height: 'auto',
                                 margin: '6px',
                                 borderRadius: '4px'
                               }}/><span className="text-justify">{info}</span></TooltipTrigger>
        <TooltipContent style={{ backgroundColor: 'transparent'}}>
          <Image src={url} width={400} height={400} alt={`A landmark from ${location}`}
                 style={{height: 'auto', borderRadius: '6px'}}/>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
}
