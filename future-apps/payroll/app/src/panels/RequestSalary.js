import React from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import {
  Button,
  SidePanel,
  IconAttention,
  Info,
  theme,
  Text,
  IconFundraising
} from '@aragon/ui'
import { differenceInSeconds } from 'date-fns'

import { connect } from '../context/AragonContext'
import priceFeedAbi from './abi/price-feed'
import { formatCurrency } from '../utils/formatting'

import Section from '../components/Layout/Section'
import PartitionBar from '../components/Bar/PartitionBar'
import EditSalaryAllocation from './EditSalaryAllocation'

class RequestSalary extends React.Component {
  state = {
    isEditing: false
  }

  async componentDidUpdate (prevProps) {
    if (!this.state.balance || this.hasAllocationChanged(prevProps)) {
      try {
        const balance = await this.getBalance()
        this.setState({ balance })
      } catch (err) {
        console.error('Error occurred', err)
      }
    }
  }

  hasAllocationChanged = prevProps => {
    const { salaryAllocation } = this.props
    const { salaryAllocation: prevSalaryAllocation } = prevProps

    let result = false

    if (prevSalaryAllocation) {
      result = !prevSalaryAllocation.every((prev, i) => {
        const current = salaryAllocation[i]

        return (
          prev.address === current.address &&
          prev.symbol === current.symbol &&
          prev.allocation === current.allocation
        )
      })
    }

    return result
  }

  getBalance = async () => {
    const { accountAddress, employees, denominationToken, tokens } = this.props

    const employee = employees.find(
      employee => employee.accountAddress === accountAddress
    )

    let balance = {
      accruedTime: 0,
      accruedSalary: 0,
      formatedAccruedSalary: '',
      accruedAllocation: []
    }

    if (employee) {
      const salaryAllocationXRT = await this.loadSalaryAllocationXRT()

      const accruedTime = differenceInSeconds(
        new Date(),
        new Date(employee.lastPayroll)
      )
      const accruedSalary = accruedTime * employee.salary

      const accruedAllocation = salaryAllocationXRT.map(tokenAllocation => {
        const token = tokens.find(
          token => token.address === tokenAllocation.address
        )
        const proportion = accruedSalary * tokenAllocation.allocation / 100
        const formatedProportion = formatCurrency(
          proportion,
          denominationToken.symbol,
          10,
          denominationToken.decimals
        )
        const tokenAmount = proportion * tokenAllocation.xrt
        const formatedTokenAmount = formatCurrency(
          tokenAmount,
          token.symbol,
          10,
          token.decimals
        )

        return {
          ...tokenAllocation,
          proportion,
          formatedProportion,
          tokenAmount,
          formatedTokenAmount
        }
      })

      const formatedAccruedSalary = formatCurrency(
        accruedSalary,
        denominationToken.symbol,
        10,
        denominationToken.decimals
      )

      balance = {
        accruedTime,
        accruedSalary,
        formatedAccruedSalary,
        accruedAllocation
      }
    }

    return balance
  }

  loadSalaryAllocationXRT = () => {
    const {
      app,
      priceFeedAddress,
      salaryAllocation,
      denominationToken
    } = this.props

    const priceFeed = app.external(priceFeedAddress, priceFeedAbi)

    return Promise.all(
      salaryAllocation.map(tokenAllocation => {
        return priceFeed
          .get(denominationToken.address, tokenAllocation.address)
          .first()
          .map(({ xrt }) => {
            return {
              ...tokenAllocation,
              xrt
            }
          })
          .toPromise()
      })
    )
  }

  handlePanelToggle = opened => {
    console.log('handlePanelToggle', opened)
    console.log(this)
  }

  handleRequestClick = event => {
    event.preventDefault()
  }

  startEditing = () => {
    this.setState({ isEditing: true })
  }

  endEditing = () => {
    this.setState({ isEditing: false })
  }

  render () {
    const { opened, onClose } = this.props
    const { balance, isEditing } = this.state

    const accruedAllocation = balance
      ? balance.accruedAllocation.map(tokenAllocation => {
        const description = (
          <AllocationDescription>
            <div>
              <Text weight='bold'>{tokenAllocation.formatedTokenAmount}</Text>
            </div>
            <div>
              <Text color='textSecondary'>
                {tokenAllocation.formatedProportion}
              </Text>
            </div>
          </AllocationDescription>
        )

        return {
          ...tokenAllocation,
          description
        }
      })
      : []

    const panel = (
      <SidePanel
        title='Request salary'
        opened={opened}
        onClose={onClose}
        onTransitionEnd={this.handlePanelToggle}
      >
        <Container>
          <AllocationWrapper>
            <SectionTitle>Salary Allocation</SectionTitle>

            {accruedAllocation && <PartitionBar data={accruedAllocation} />}

            <TotalAllocationWrapper>
              <Text weight='bolder'>Total salary</Text>
              <div>
                <span />
                <Text weight='bolder'>
                  {balance && balance.formatedAccruedSalary}
                </Text>
              </div>
              <Text weight='bolder'>100%</Text>
            </TotalAllocationWrapper>

            <EditButton
              onClick={this.startEditing}
              data-testid='salary-allocation-edit-btn'
            >
              Edit salary allocation
            </EditButton>
          </AllocationWrapper>

          <SalaryWrapper>
            <Section.Title>Total Salary</Section.Title>
            <Info>
              <InfoTotalItem>
                <IconFundraising />
                <Text color={theme.textSecondary}>Total salary to be paid</Text>
              </InfoTotalItem>
              <InfoTotalItem>
                {balance && (
                  <Text size='xxlarge'>{balance.formatedAccruedSalary}</Text>
                )}
              </InfoTotalItem>
            </Info>
          </SalaryWrapper>

          <ButtonWrapper>
            <Info.Permissions icon={<IconAttention />}>
              The actual exchange reate might change once the transaction takes
              place
            </Info.Permissions>

            <RequestButton onClick={this.handleRequestClick}>
              Request Salary
            </RequestButton>
          </ButtonWrapper>

          <EditSalaryAllocation
            opened={isEditing}
            onClose={this.endEditing}
            modalRootId='edit-allocation'
          />
        </Container>
      </SidePanel>
    )

    return createPortal(panel, document.getElementById('modal-root'))
  }
}

RequestSalary.propsType = {
  onClose: PropTypes.func,
  opened: PropTypes.bool
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`

const SectionTitle = styled(Section.Title)`
  margin-bottom: 0;
`

const AllocationWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 20px;
  border-bottom: 1px solid ${theme.contentBorder};
`

const TotalAllocationWrapper = styled.div`
  display: grid;
  grid-template-columns: 2fr 6fr 1fr;

  > :nth-child(2) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: end;
  }

  > :last-child {
    justify-self: end;
  }
`

const AllocationDescription = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  justify-items: end;
`

const SalaryWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

const InfoTotalItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`

const EditButton = styled(Button).attrs({ mode: 'text' })`
  align-self: flex-end;
`

const ButtonWrapper = styled.div``

const RequestButton = styled(Button).attrs({ mode: 'strong', wide: true })`
  margin-top: 20px;
`
function mapStateToProps ({
  accountAddress = '',
  denominationToken = {},
  employees = [],
  priceFeedAddress = '',
  salaryAllocation = [],
  tokens = []
}) {
  return {
    accountAddress,
    denominationToken,
    employees,
    priceFeedAddress,
    salaryAllocation,
    tokens
  }
}

export default connect(mapStateToProps)(RequestSalary)