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

export type AppSubscriptionCancelMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type AppSubscriptionCancelMutation = { appSubscriptionCancel?: AdminTypes.Maybe<{ appSubscription?: AdminTypes.Maybe<Pick<AdminTypes.AppSubscription, 'id' | 'status'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type CreateSubscriptionMutationVariables = AdminTypes.Exact<{
  name: AdminTypes.Scalars['String']['input'];
  lineItems: Array<AdminTypes.AppSubscriptionLineItemInput> | AdminTypes.AppSubscriptionLineItemInput;
  returnUrl: AdminTypes.Scalars['URL']['input'];
  test: AdminTypes.Scalars['Boolean']['input'];
  trialDays?: AdminTypes.InputMaybe<AdminTypes.Scalars['Int']['input']>;
}>;


export type CreateSubscriptionMutation = { appSubscriptionCreate?: AdminTypes.Maybe<(
    Pick<AdminTypes.AppSubscriptionCreatePayload, 'confirmationUrl'>
    & { appSubscription?: AdminTypes.Maybe<Pick<AdminTypes.AppSubscription, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }
  )> };

interface GeneratedQueryTypes {
  "#graphql\n  query getDraftOrders($first: Int, $last: Int, $after: String, $before: String, $reverse: Boolean, $query: String) {\n    draftOrders(first: $first, last: $last, after: $after, before: $before, reverse: $reverse, query: $query) {\n      edges {\n        node {\n          id\n          name\n          createdAt\n          status\n          totalPriceSet {\n            shopMoney {\n              amount\n              currencyCode\n            }\n          }\n          customer {\n            displayName\n          }\n        }\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n": {return: GetDraftOrdersQuery, variables: GetDraftOrdersQueryVariables},
  "#graphql\n  query getDraftOrder($id: ID!) {\n    draftOrder(id: $id) {\n      id\n      name\n      createdAt\n      status\n      note2\n      customAttributes {\n        key\n        value\n      }\n      subtotalPriceSet {\n        shopMoney {\n          amount\n          currencyCode\n        }\n      }\n      totalShippingPriceSet {\n        shopMoney {\n          amount\n        }\n      }\n      totalTaxSet {\n        shopMoney {\n          amount\n        }\n      }\n      totalPriceSet {\n        shopMoney {\n          amount\n          currencyCode\n        }\n      }\n      customer {\n        displayName\n        defaultEmailAddress {\n          emailAddress\n        }\n      }\n      shippingAddress {\n        name\n        address1\n        address2\n        city\n        province\n        country\n        zip\n        phone\n      }\n      billingAddress {\n        name\n        address1\n        address2\n        city\n        province\n        country\n        zip\n        phone\n      }\n      lineItems(first: 50) {\n        edges {\n          node {\n            id\n            title\n            quantity\n            sku\n            variantTitle\n            variant {\n              id\n            }\n            image {\n              url\n            }\n            originalUnitPriceSet {\n              shopMoney {\n                amount\n              }\n            }\n            customAttributes {\n              key\n              value\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: GetDraftOrderQuery, variables: GetDraftOrderQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {\n    draftOrderUpdate(id: $id, input: $input) {\n      draftOrder {\n        id\n        note2\n        customAttributes {\n          key\n          value\n        }\n        lineItems(first: 50) {\n          edges {\n            node {\n              id\n              quantity\n              originalUnitPriceSet {\n                shopMoney {\n                  amount\n                }\n              }\n            }\n          }\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: DraftOrderUpdateMutation, variables: DraftOrderUpdateMutationVariables},
  "#graphql\n        mutation AppSubscriptionCancel($id: ID!) {\n          appSubscriptionCancel(id: $id) {\n            appSubscription {\n              id\n              status\n            }\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: AppSubscriptionCancelMutation, variables: AppSubscriptionCancelMutationVariables},
  "#graphql\n    mutation CreateSubscription($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean!, $trialDays: Int) {\n      appSubscriptionCreate(\n        name: $name\n        lineItems: $lineItems\n        returnUrl: $returnUrl\n        test: $test\n        trialDays: $trialDays\n        replacementBehavior: APPLY_IMMEDIATELY\n      ) {\n        appSubscription {\n          id\n        }\n        confirmationUrl\n        userErrors {\n          field\n          message\n        }\n      }\n    }": {return: CreateSubscriptionMutation, variables: CreateSubscriptionMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
