import axios, { AxiosInstance } from 'axios'

export interface WCProduct {
  id: number
  name: string
  sku: string
  status: string
  date_created: string
  categories: Array<{ id: number; name: string }>
  meta_data: Array<{ key: string; value: string }>
}

export interface WCOrder {
  id: number
  status: string
  date_created: string
  total: string
  shipping_total: string
  customer_id: number
  billing: {
    first_name: string
    last_name: string
    email: string
  }
  line_items: Array<{
    id: number
    product_id: number
    name: string
    quantity: number
    total: string
    sku: string
  }>
}

export interface WCCustomer {
  id: number
  email: string
  first_name: string
  last_name: string
}

function createWooCommerceClient(): AxiosInstance {
  const baseURL = process.env.WOOCOMMERCE_URL
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

  if (!baseURL || !consumerKey || !consumerSecret) {
    throw new Error('WooCommerce credentials not configured')
  }

  return axios.create({
    baseURL: `${baseURL}/wp-json/wc/v3`,
    auth: {
      username: consumerKey,
      password: consumerSecret,
    },
    timeout: 30000,
  })
}

async function fetchAllPages<T>(
  client: AxiosInstance,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T[]> {
  const results: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await client.get<T[]>(endpoint, {
      params: { per_page: 100, page, ...params },
    })

    results.push(...response.data)

    const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1', 10)
    hasMore = page < totalPages
    page++
  }

  return results
}

export async function fetchProducts(): Promise<WCProduct[]> {
  const client = createWooCommerceClient()
  return fetchAllPages<WCProduct>(client, '/products', { status: 'publish' })
}

export async function fetchOrders(afterDate?: string, beforeDate?: string): Promise<WCOrder[]> {
  const client = createWooCommerceClient()
  const params: Record<string, string | number> = { status: 'any' }
  if (afterDate) params.after = afterDate
  if (beforeDate) params.before = beforeDate
  return fetchAllPages<WCOrder>(client, '/orders', params)
}

export async function fetchProductCOGS(productId: number): Promise<number | null> {
  const client = createWooCommerceClient()
  const response = await client.get<WCProduct>(`/products/${productId}`)
  const cogsMeta = response.data.meta_data.find((m) => m.key === '_wc_cog_cost')
  return cogsMeta ? parseFloat(cogsMeta.value) || null : null
}
