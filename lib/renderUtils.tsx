import Image from "next/image";

export function renderLandmark(location: string, url: string, info: string) {

  // Replace the location name with the formatted output in the delta text
  // <span key="1">{location}</span> <span key="2">{url}</span>  <span key="3">{info}
  return <div className="text-red-600 p-1"><Image src={url} width={100} height={100} alt={`A landmark from ${location}`} style={{float: 'left', height: 'auto', margin: '0 10px 10px 0px'}}/><span>{info}</span></div>;
}
