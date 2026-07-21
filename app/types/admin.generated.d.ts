/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type GetDraftOrdersQueryVariables = AdminTypes.Exact<{
  first?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
  last?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  before?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  reverse?: AdminTypes.InputMaybe<AdminTypes.Scalars['Boolean']['input']>;
  query?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetDraftOrdersQuery = { draftOrders: { edges: Array<{ node: (
        Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'createdAt' | 'status'>
        & { totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'displayName'>> }
      ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'> } };

export type GetDraftOrderQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type GetDraftOrderQuery = { draftOrder?: AdminTypes.Maybe<(
    Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'createdAt' | 'status' | 'note2'>
    & { customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>>, subtotalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, totalShippingPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, totalTaxSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, customer?: AdminTypes.Maybe<(
      Pick<AdminTypes.Customer, 'displayName'>
      & { defaultEmailAddress?: AdminTypes.Maybe<Pick<AdminTypes.CustomerEmailAddress, 'emailAddress'>> }
    )>, shippingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'name' | 'address1' | 'address2' | 'city' | 'province' | 'country' | 'zip' | 'phone'>>, billingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'name' | 'address1' | 'address2' | 'city' | 'province' | 'country' | 'zip' | 'phone'>>, lineItems: { edges: Array<{ node: (
          Pick<AdminTypes.DraftOrderLineItem, 'id' | 'title' | 'quantity' | 'sku' | 'variantTitle'>
          & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>>, image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>>, originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>> }
        ) }> } }
  )> };

export type DraftOrderUpdateMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  input: AdminTypes.DraftOrderInput;
}>;


export type DraftOrderUpdateMutation = { draftOrderUpdate?: AdminTypes.Maybe<{ draftOrder?: AdminTypes.Maybe<(
      Pick<AdminTypes.DraftOrder, 'id' | 'note2'>
      & { customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>>, lineItems: { edges: Array<{ node: (
            Pick<AdminTypes.DraftOrderLineItem, 'id' | 'quantity'>
            & { originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> } }
          ) }> } }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type DraftOrderCreateMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.DraftOrderInput;
}>;


export type DraftOrderCreateMutation = { draftOrderCreate?: AdminTypes.Maybe<{ draftOrder?: AdminTypes.Maybe<Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'invoiceUrl'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type CustomerDraftOrderFieldsFragment = (
  Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'createdAt' | 'status' | 'invoiceUrl'>
  & { totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, lineItems: { edges: Array<{ node: (
        Pick<AdminTypes.DraftOrderLineItem, 'id' | 'title' | 'quantity' | 'variantTitle'>
        & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>>, originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>>, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>> }
      ) }> } }
);

export type GetCustomerDraftOrdersQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type GetCustomerDraftOrdersQuery = { draftOrders: { edges: Array<{ node: (
        Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'createdAt' | 'status' | 'invoiceUrl'>
        & { totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, lineItems: { edges: Array<{ node: (
              Pick<AdminTypes.DraftOrderLineItem, 'id' | 'title' | 'quantity' | 'variantTitle'>
              & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>>, originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>>, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>> }
            ) }> } }
      ) }> } };

export type GetRecentDraftOrdersQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
}>;


export type GetRecentDraftOrdersQuery = { draftOrders: { edges: Array<{ node: (
        Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'createdAt' | 'status' | 'invoiceUrl'>
        & { totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, lineItems: { edges: Array<{ node: (
              Pick<AdminTypes.DraftOrderLineItem, 'id' | 'title' | 'quantity' | 'variantTitle'>
              & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>>, originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>>, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>> }
            ) }> } }
      ) }> } };

export type GetDraftOrderVariantOptionsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type GetDraftOrderVariantOptionsQuery = { draftOrder?: AdminTypes.Maybe<(
    Pick<AdminTypes.DraftOrder, 'id'>
    & { customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'id'>>, lineItems: { edges: Array<{ node: (
          Pick<AdminTypes.DraftOrderLineItem, 'id'>
          & { variant?: AdminTypes.Maybe<(
            Pick<AdminTypes.ProductVariant, 'id'>
            & { product: { variants: { edges: Array<{ node: (
                    Pick<AdminTypes.ProductVariant, 'id' | 'title' | 'price' | 'availableForSale'>
                    & { media: { nodes: Array<{ preview?: AdminTypes.Maybe<{ image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>> }> }> } }
                  ) }> } } }
          )> }
        ) }> } }
  )> };

export type GetDraftOrderForCustomerUpdateQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type GetDraftOrderForCustomerUpdateQuery = { draftOrder?: AdminTypes.Maybe<(
    Pick<AdminTypes.DraftOrder, 'id' | 'status'>
    & { customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'id'>>, lineItems: { edges: Array<{ node: (
          Pick<AdminTypes.DraftOrderLineItem, 'id' | 'quantity'>
          & { originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> }, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>>, variant?: AdminTypes.Maybe<(
            Pick<AdminTypes.ProductVariant, 'id'>
            & { product: { variants: { edges: Array<{ node: Pick<AdminTypes.ProductVariant, 'id' | 'price'> }> } } }
          )> }
        ) }> } }
  )> };

interface GeneratedQueryTypes {
  "#graphql\n  query getDraftOrders($first: Int, $last: Int, $after: String, $before: String, $reverse: Boolean, $query: String) {\n    draftOrders(first: $first, last: $last, after: $after, before: $before, reverse: $reverse, query: $query) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          status\n          totalPriceSet {\n            shopMoney {\n              amount\n              currencyCode\n            }\n          }\n          customer {\n            displayName\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": {return: GetDraftOrdersQuery, variables: GetDraftOrdersQueryVariables},
  "#graphql\n  query getDraftOrder($id: ID!) {\n    draftOrder(id: $id) {\n      id\n      name\n      createdAt\n      status\n      note2\n      customAttributes {\n        key\n        value\n      }\n      subtotalPriceSet {\n        shopMoney {\n          amount\n          currencyCode\n        }\n      }\n      totalShippingPriceSet {\n        shopMoney {\n          amount\n        }\n      }\n      totalTaxSet {\n        shopMoney {\n          amount\n        }\n      }\n      totalPriceSet {\n        shopMoney {\n          amount\n          currencyCode\n        }\n      }\n      customer {\n        displayName\n        defaultEmailAddress {\n          emailAddress\n        }\n      }\n      shippingAddress {\n        name\n        address1\n        address2\n        city\n        province\n        country\n        zip\n        phone\n      }\n      billingAddress {\n        name\n        address1\n        address2\n        city\n        province\n        country\n        zip\n        phone\n      }\n      lineItems(first: 50) {\n        edges {\n          node {\n            id\n            title\n            quantity\n            sku\n            variantTitle\n            variant {\n              id\n            }\n            image {\n              url\n            }\n            originalUnitPriceSet {\n              shopMoney {\n                amount\n              }\n            }\n            customAttributes {\n              key\n              value\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetDraftOrderQuery, variables: GetDraftOrderQueryVariables},
  "#graphql\n  query getCustomerDraftOrders($query: String!) {\n    draftOrders(first: 10, query: $query, sortKey: NUMBER, reverse: true) {\n      edges {\n        node {\n          ...CustomerDraftOrderFields\n        }\n      }\n    }\n  }\n  #graphql\n  fragment CustomerDraftOrderFields on DraftOrder {\n    id\n    name\n    createdAt\n    status\n    invoiceUrl\n    totalPriceSet {\n      shopMoney {\n        amount\n        currencyCode\n      }\n    }\n    lineItems(first: 50) {\n      edges {\n        node {\n          id\n          title\n          quantity\n          variantTitle\n          image {\n            url\n          }\n          originalUnitPriceSet {\n            shopMoney {\n              amount\n            }\n          }\n          variant {\n            id\n          }\n          customAttributes {\n            key\n            value\n          }\n        }\n      }\n    }\n  }\n\n": {return: GetCustomerDraftOrdersQuery, variables: GetCustomerDraftOrdersQueryVariables},
  "#graphql\n  query getRecentDraftOrders($first: Int!) {\n    draftOrders(first: $first, reverse: true) {\n      edges {\n        node {\n          ...CustomerDraftOrderFields\n        }\n      }\n    }\n  }\n  #graphql\n  fragment CustomerDraftOrderFields on DraftOrder {\n    id\n    name\n    createdAt\n    status\n    invoiceUrl\n    totalPriceSet {\n      shopMoney {\n        amount\n        currencyCode\n      }\n    }\n    lineItems(first: 50) {\n      edges {\n        node {\n          id\n          title\n          quantity\n          variantTitle\n          image {\n            url\n          }\n          originalUnitPriceSet {\n            shopMoney {\n              amount\n            }\n          }\n          variant {\n            id\n          }\n          customAttributes {\n            key\n            value\n          }\n        }\n      }\n    }\n  }\n\n": {return: GetRecentDraftOrdersQuery, variables: GetRecentDraftOrdersQueryVariables},
  "#graphql\n  query getDraftOrderVariantOptions($id: ID!) {\n    draftOrder(id: $id) {\n      id\n      customer {\n        id\n      }\n      lineItems(first: 50) {\n        edges {\n          node {\n            id\n            variant {\n              id\n              product {\n                variants(first: 100) {\n                  edges {\n                    node {\n                      id\n                      title\n                      price\n                      availableForSale\n                      media(first: 1) {\n                        nodes {\n                          preview {\n                            image {\n                              url\n                            }\n                          }\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetDraftOrderVariantOptionsQuery, variables: GetDraftOrderVariantOptionsQueryVariables},
  "#graphql\n  query getDraftOrderForCustomerUpdate($id: ID!) {\n    draftOrder(id: $id) {\n      id\n      status\n      customer {\n        id\n      }\n      lineItems(first: 50) {\n        edges {\n          node {\n            id\n            quantity\n            originalUnitPriceSet {\n              shopMoney {\n                amount\n                currencyCode\n              }\n            }\n            customAttributes {\n              key\n              value\n            }\n            variant {\n              id\n              product {\n                variants(first: 100) {\n                  edges {\n                    node {\n                      id\n                      price\n                    }\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetDraftOrderForCustomerUpdateQuery, variables: GetDraftOrderForCustomerUpdateQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {\n    draftOrderUpdate(id: $id, input: $input) {\n      draftOrder {\n        id\n        note2\n        customAttributes {\n          key\n          value\n        }\n        lineItems(first: 50) {\n          edges {\n            node {\n              id\n              quantity\n              originalUnitPriceSet {\n                shopMoney {\n                  amount\n                }\n              }\n            }\n          }\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: DraftOrderUpdateMutation, variables: DraftOrderUpdateMutationVariables},
  "#graphql\n  mutation draftOrderCreate($input: DraftOrderInput!) {\n    draftOrderCreate(input: $input) {\n      draftOrder {\n        id\n        name\n        invoiceUrl\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: DraftOrderCreateMutation, variables: DraftOrderCreateMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
