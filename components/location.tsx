type LocationProps = {
  location: string
  data: any
}

export default function Location({ data, location }: LocationProps) {
    console.log('Location data: ', data)
    console.log('location location: ', location)
    if (!data.value) {
      return <span>...Loading...</span>
    }
    console.log('locationData: ', data)
    return <span>{JSON.stringify(data)}</span>
}

