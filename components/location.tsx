type LocationProps = {
  data: any
}

export default function Location({ data }: LocationProps) {
    console.log('Location data: ', data)
    if (!data.value) {
      return <span>...Loading...</span>
    }
    console.log('locationData: ', data)
    return <span>{JSON.stringify(data)}</span>
}

